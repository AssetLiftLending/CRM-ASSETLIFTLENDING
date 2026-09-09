import type { SupabaseClient } from '@supabase/supabase-js'

/** Postgres "column does not exist". */
export const MISSING_COLUMN = '42703'

let cachedReadTracking: boolean | null = null

/**
 * Whether communications.read_at exists yet.
 *
 * The read-tracking migration ships with the inbox but has to be applied to the
 * database separately, so the inbox has to work either way: with the column it
 * shows unread badges, without it every thread simply reads as seen. Probing
 * once per process is cheaper than letting every list query fail and retry.
 */
export async function hasReadTracking(supabase: SupabaseClient): Promise<boolean> {
  if (cachedReadTracking !== null) return cachedReadTracking

  const { error } = await supabase.from('communications').select('read_at').limit(1)
  cachedReadTracking = !(error && error.code === MISSING_COLUMN)
  return cachedReadTracking
}

/** Test seam — lets a caller force a re-probe after applying the migration. */
export function resetReadTrackingCache() {
  cachedReadTracking = null
}

export const THREAD_LIST_FIELDS =
  'id, contact_id, type, direction, body, snippet, subject, status, ai_summary, created_at, ' +
  'contacts(id, first_name, last_name, email, phone, cell_phone, whatsapp, stage, lead_source)'

type Row = Record<string, any>

export interface ThreadContact {
  id: string
  first_name?: string
  last_name?: string
  email?: string | null
  phone?: string | null
  cell_phone?: string | null
  whatsapp?: string | null
  stage?: string | null
  lead_source?: string | null
  created_at?: string
}

export interface Conversation {
  contact_id: string
  contact: ThreadContact
  last_message: { id: string; type: string; direction?: string; preview: string; created_at: string }
  unread: number
  channels: string[]
  message_count: number
}

function previewOf(row: Row): string {
  if (row.type === 'call') {
    return row.ai_summary || (row.direction === 'inbound' ? 'Incoming call' : 'Outgoing call')
  }
  const raw = row.snippet || row.body || row.subject || ''
  return String(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
}

/**
 * Fold a newest-first window of messages into one entry per contact.
 *
 * PostgREST cannot express "latest row per group", so the rows arrive ordered
 * and the first one seen for a contact is that thread's most recent message.
 */
export function buildConversations(rows: Row[], withRead: boolean): Conversation[] {
  const threads = new Map<string, Conversation & { channelSet: Set<string> }>()

  for (const row of rows) {
    const contact = (Array.isArray(row.contacts) ? row.contacts[0] : row.contacts) as
      | ThreadContact
      | null
      | undefined
    if (!contact || !row.contact_id) continue

    let thread = threads.get(row.contact_id)
    if (!thread) {
      thread = {
        contact_id: row.contact_id,
        contact,
        last_message: {
          id: row.id,
          type: row.type,
          direction: row.direction,
          preview: previewOf(row),
          created_at: row.created_at,
        },
        unread: 0,
        channels: [],
        message_count: 0,
        channelSet: new Set<string>(),
      }
      threads.set(row.contact_id, thread)
    }

    thread.message_count++
    thread.channelSet.add(row.type)
    if (withRead && row.direction === 'inbound' && !row.read_at) thread.unread++
  }

  return [...threads.values()]
    .map(({ channelSet, ...rest }) => ({ ...rest, channels: [...channelSet] }))
    .sort((a, b) => b.last_message.created_at.localeCompare(a.last_message.created_at))
}
