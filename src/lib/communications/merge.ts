import type { StaffContext } from '@/lib/auth/session'
import { getAppUrl } from '@/lib/utils/app-url'

export interface MergeContact {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  cell_phone?: string | null
  city?: string | null
  state?: string | null
  entity_name?: string | null
}

export interface MergeDeal {
  loan_program?: string | null
  property_address?: string | null
  loan_amount?: number | null
}

/** Used when a contact has no first name, so greetings read "Hi there," not "Hi ,". */
const FALLBACK_NAME = 'there'

/**
 * Every {{merge_tag}} the CRM knows how to fill, in one place.
 *
 * Templates, the inbox composer, and the automation engine all resolve against
 * this same set — when they disagreed, tags one path knew about went out raw in
 * another.
 */
export function buildMergeVars(
  contact?: MergeContact | null,
  sender?: StaffContext | null,
  extra?: Record<string, string | null | undefined>,
) {
  const firstName = contact?.first_name?.trim() ?? ''
  const lastName  = contact?.last_name?.trim() ?? ''
  const fullName  = [firstName, lastName].filter(Boolean).join(' ')

  const vars: Record<string, string> = {
    // Greetings must never render empty, so these fall back to a neutral word.
    first_name:    firstName || FALLBACK_NAME,
    contact_name:  fullName || FALLBACK_NAME,
    full_name:     fullName || FALLBACK_NAME,
    name:          fullName || FALLBACK_NAME,
    last_name:     lastName,
    email:         contact?.email ?? '',
    phone:         contact?.phone ?? contact?.cell_phone ?? '',
    city:          contact?.city ?? '',
    state:         contact?.state ?? '',
    entity_name:   contact?.entity_name ?? '',
    agent_name:    sender?.fullName ?? process.env.SENDGRID_FROM_NAME ?? 'Asset Lift Lending',
    agent_email:   sender?.email ?? process.env.SENDGRID_FROM_EMAIL ?? '',
    agent_phone:   sender?.phone ?? process.env.TWILIO_PHONE_NUMBER ?? '',
    company_name:  process.env.SENDGRID_FROM_NAME ?? 'Asset Lift Lending',
    company_phone: process.env.TWILIO_PHONE_NUMBER ?? '',
    portal_url:    `${getAppUrl()}/portal`,
    doc_name:      'documents',
    date:          new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
    time:          new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
  }

  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value != null && value !== '') vars[key] = String(value)
  }

  return vars
}

const TAG = /\{\{\s*(\w+)\s*\}\}/g

/**
 * Fills merge tags in a subject, SMS body, or email body.
 *
 * An unknown tag resolves to an empty string. It is never left in place: a
 * borrower receiving "Hi {{first_name}}" is worse than a slightly clipped
 * sentence, and it is the one mistake that unmistakably reads as automated.
 */
export function renderTemplate(text: string, vars: Record<string, string>) {
  if (!text) return ''
  return text
    .replace(TAG, (_, key: string) => vars[key] ?? '')
    // Tidy the punctuation an empty tag leaves behind ("Hi ,", "on  for").
    .replace(/([:,!?]) *([,.!?])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .replace(/ +([,.!?;:])/g, '$1')
}

/** Tags in a string that buildMergeVars cannot fill — used to warn before sending. */
export function unresolvedTags(text: string, vars: Record<string, string>) {
  const found = new Set<string>()
  for (const match of text.matchAll(TAG)) {
    if (!(match[1] in vars)) found.add(match[1])
  }
  return [...found]
}
