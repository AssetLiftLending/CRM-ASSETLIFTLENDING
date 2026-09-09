import type { SupabaseClient } from '@supabase/supabase-js'
import type { GhlConversation, GhlMessage } from '@/lib/ghl/client'
import { phoneDigits } from '@/lib/twilio/phone'

/**
 * Maps GoHighLevel conversation history onto CRM communications.
 *
 * GHL's message payloads are not consistent across account ages — `type` comes
 * back as a number on some locations and a string like "TYPE_SMS" on others —
 * so every field is read defensively and anything unrecognised is kept as a
 * note rather than dropped. Losing a borrower's history to a field rename is
 * worse than filing one message under the wrong heading.
 */

export type CommType = 'call' | 'sms' | 'email' | 'whatsapp' | 'note'

const TYPE_PATTERNS: Array<[RegExp, CommType]> = [
  [/whatsapp/i, 'whatsapp'],
  [/call|voice|ivr/i, 'call'],
  [/email/i, 'email'],
  [/sms|text|message/i, 'sms'],
]

// Numeric message types used by GHL's older payloads.
const NUMERIC_TYPES: Record<number, CommType> = {
  1: 'sms', 2: 'email', 3: 'call', 4: 'call', 25: 'whatsapp', 29: 'whatsapp',
}

export function mapMessageType(message: GhlMessage): CommType {
  const label = String(message.messageType ?? message.type ?? '')
  for (const [pattern, type] of TYPE_PATTERNS) {
    if (pattern.test(label)) return type
  }
  const numeric = Number(message.type)
  if (Number.isFinite(numeric) && NUMERIC_TYPES[numeric]) return NUMERIC_TYPES[numeric]
  return 'note'
}

export function mapDirection(message: GhlMessage): 'inbound' | 'outbound' | null {
  const value = String(message.direction ?? '').toLowerCase()
  if (value.includes('in')) return 'inbound'
  if (value.includes('out')) return 'outbound'
  return null
}

function readMeta(message: GhlMessage) {
  const meta = (message.meta ?? {}) as Record<string, any>
  const call = (meta.call ?? meta.callData ?? {}) as Record<string, any>

  const durationRaw = call.duration ?? meta.duration ?? (message as any).duration
  const duration = Number(durationRaw)

  const recording =
    call.recordingUrl ?? meta.recordingUrl ?? (message as any).recordingUrl ?? null

  return {
    duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
    recording: typeof recording === 'string' && recording.startsWith('http') ? recording : null,
  }
}

function plainText(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

export interface MappedMessage {
  external_id: string
  type: CommType
  direction: 'inbound' | 'outbound' | null
  body: string | null
  snippet: string | null
  subject: string | null
  duration_secs: number | null
  recording_url: string | null
  status: string | null
  created_at: string
}

/** Turns one GHL message into a communications row. Returns null if it carries nothing. */
export function mapMessage(message: GhlMessage): MappedMessage | null {
  if (!message?.id) return null

  const type = mapMessageType(message)
  const { duration, recording } = readMeta(message)
  const rawBody = typeof message.body === 'string' ? message.body : ''
  const attachments = Array.isArray(message.attachments) ? message.attachments : []

  let body = rawBody
  if (!body && attachments.length) {
    body = `[${attachments.length} attachment${attachments.length === 1 ? '' : 's'}]`
  }
  // A call with no transcript is still worth keeping as a record of the call.
  if (!body && type === 'call') body = duration ? `Call — ${duration}s` : 'Call'
  if (!body && !recording) return null

  const text = plainText(body)

  return {
    external_id: `ghl_${message.id}`,
    type,
    direction: mapDirection(message),
    body: body || null,
    snippet: text ? text.slice(0, 200) : null,
    subject: typeof (message as any).subject === 'string' ? (message as any).subject : null,
    duration_secs: duration,
    recording_url: recording,
    status: typeof message.status === 'string' ? message.status : 'imported',
    // Keep the original date, so history lands where it belongs on the timeline.
    created_at: parseDate(message.dateAdded) ?? new Date().toISOString(),
  }
}

function parseDate(value: unknown): string | null {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Finds the CRM contact a conversation belongs to, by email then phone.
 * Imports never create contacts — that is the CSV import's job, and inventing
 * records from a phone number produces duplicates nobody can reconcile.
 */
export async function matchContact(
  supabase: SupabaseClient,
  conversation: GhlConversation,
): Promise<{ id: string; organization_id?: string | null } | null> {
  const email = String(conversation.email ?? '').trim().toLowerCase()
  if (email) {
    const { data } = await supabase
      .from('contacts')
      .select('id, organization_id')
      .ilike('email', email)
      .limit(1)
      .maybeSingle()
    if (data) return data
  }

  const digits = phoneDigits(String(conversation.phone ?? ''))
  if (digits) {
    const { data } = await supabase
      .from('contacts')
      .select('id, organization_id')
      .or(`phone_digits.eq.${digits},cell_phone_digits.eq.${digits}`)
      .limit(1)
      .maybeSingle()
    if (data) return data
  }

  return null
}
