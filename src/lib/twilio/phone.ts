import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Normalizes user- and Twilio-supplied numbers to E.164 (+15551234567).
 * Returns null when the input cannot be a real US/international number.
 */
export function toE164(input?: string | null, defaultCountryCode = '1'): string | null {
  if (!input) return null
  const trimmed = String(input).trim().replace(/^whatsapp:/i, '')
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  if (!digits) return null
  if (hasPlus) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length > 11) return `+${digits}`
  return null
}

/** Last 10 digits — what we match contacts on, regardless of stored formatting. */
export function phoneDigits(input?: string | null): string | null {
  const e164 = toE164(input)
  if (!e164) return null
  return e164.replace(/\D/g, '').slice(-10)
}

/** Formatting-tolerant LIKE patterns, used before the generated digit columns exist. */
function likePatterns(last10: string) {
  const [a, b, c] = [last10.slice(0, 3), last10.slice(3, 6), last10.slice(6)]
  return [
    `%${last10}%`,
    `%${a}%${b}%${c}%`,
  ]
}

export interface MatchedContact {
  id: string
  first_name?: string | null
  last_name?: string | null
  organization_id?: string | null
  assigned_to?: string | null
}

const CONTACT_FIELDS = 'id, first_name, last_name, organization_id, assigned_to'

/**
 * Finds the contact behind an inbound number.
 * Prefers the indexed digit columns from schema-communications.sql and falls
 * back to pattern matching so inbound routing works before that migration runs.
 */
export async function findContactByPhone(
  supabase: SupabaseClient,
  phone?: string | null
): Promise<MatchedContact | null> {
  const last10 = phoneDigits(phone)
  if (!last10) return null

  const exact = await supabase
    .from('contacts')
    .select(CONTACT_FIELDS)
    .or(`phone_digits.eq.${last10},cell_phone_digits.eq.${last10}`)
    .limit(1)

  if (!exact.error) return (exact.data?.[0] as MatchedContact) ?? null

  const or = likePatterns(last10)
    .flatMap((p) => [`phone.ilike.${p}`, `cell_phone.ilike.${p}`, `whatsapp.ilike.${p}`])
    .join(',')

  const { data } = await supabase.from('contacts').select(CONTACT_FIELDS).or(or).limit(1)
  return (data?.[0] as MatchedContact) ?? null
}
