/**
 * GoHighLevel (LeadConnector) API v2 client.
 *
 * Used once, to lift call and message history out of GHL before the account is
 * closed. Credentials come from the environment — a Private Integration token
 * with conversations and contacts read access.
 */

const API_BASE = 'https://services.leadconnectorhq.com'

// GHL pins each endpoint group to a dated version. Overridable because they
// occasionally move, and a wrong version returns 401 rather than a clear error.
const CONVERSATIONS_VERSION = process.env.GHL_API_VERSION ?? '2021-04-15'
const CONTACTS_VERSION = process.env.GHL_CONTACTS_API_VERSION ?? '2021-07-28'

export function ghlCredentials() {
  return {
    token: process.env.GHL_API_TOKEN?.trim() ?? '',
    locationId: process.env.GHL_LOCATION_ID?.trim() ?? '',
  }
}

export function isGhlConfigured() {
  const { token, locationId } = ghlCredentials()
  return Boolean(token && locationId)
}

export class GhlError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function ghlFetch<T>(path: string, version: string): Promise<T> {
  const { token } = ghlCredentials()
  if (!token) throw new GhlError('GHL_API_TOKEN is not set.', 503)

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: version,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  const text = await res.text()

  if (!res.ok) {
    // GHL returns its reason in the body; surfacing it saves a lot of guessing.
    let detail = text.slice(0, 300)
    try {
      const parsed = JSON.parse(text)
      detail = parsed.message ?? parsed.error ?? detail
    } catch { /* not JSON — use the raw text */ }

    const hint = res.status === 401
      ? ' Check the token, and that it has conversations.readonly and contacts.readonly scopes.'
      : ''
    throw new GhlError(`GHL ${res.status}: ${detail}${hint}`, res.status)
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new GhlError('GHL returned a response that was not JSON.', 502)
  }
}

/** A conversation thread. Field names vary a little by account age, so read loosely. */
export interface GhlConversation {
  id: string
  contactId?: string
  fullName?: string
  email?: string
  phone?: string
  [key: string]: unknown
}

export interface GhlMessage {
  id: string
  type?: number | string
  messageType?: string
  direction?: string
  body?: string
  dateAdded?: string
  status?: string
  contactId?: string
  attachments?: string[]
  meta?: Record<string, unknown>
  [key: string]: unknown
}

/** One page of conversations. `startAfterDate` drives paging, newest first. */
export async function listConversations(limit: number, startAfterDate?: string) {
  const { locationId } = ghlCredentials()
  const params = new URLSearchParams({
    locationId,
    limit: String(limit),
    sortBy: 'last_message_date',
    sort: 'desc',
  })
  if (startAfterDate) params.set('startAfterDate', startAfterDate)

  const data = await ghlFetch<{ conversations?: GhlConversation[]; total?: number }>(
    `/conversations/search?${params.toString()}`,
    CONVERSATIONS_VERSION,
  )
  return { conversations: data.conversations ?? [], total: data.total ?? 0 }
}

/** Every message in one thread, oldest first once sorted by the caller. */
export async function listMessages(conversationId: string) {
  const data = await ghlFetch<{
    messages?: { messages?: GhlMessage[]; nextPage?: boolean } | GhlMessage[]
  }>(`/conversations/${conversationId}/messages`, CONVERSATIONS_VERSION)

  // The payload has been seen both as {messages:{messages:[]}} and {messages:[]}.
  const raw = data.messages
  if (Array.isArray(raw)) return raw
  return raw?.messages ?? []
}

export async function getContact(contactId: string) {
  const data = await ghlFetch<{ contact?: Record<string, unknown> }>(
    `/contacts/${contactId}`,
    CONTACTS_VERSION,
  )
  return data.contact ?? null
}

/** Cheap credential check for the admin screen. */
export async function checkGhlConnection() {
  const { token, locationId } = ghlCredentials()
  if (!token) return { ok: false, message: 'GHL_API_TOKEN is not set in your environment.' }
  if (!locationId) return { ok: false, message: 'GHL_LOCATION_ID is not set in your environment.' }

  try {
    const { total, conversations } = await listConversations(1)
    return {
      ok: true,
      message: total
        ? `Connected. ${total.toLocaleString()} conversations available.`
        : 'Connected, but GHL reported no conversations on this location.',
      total,
      sample: conversations[0] ?? null,
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Could not reach GHL.' }
  }
}
