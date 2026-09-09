import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { buildConversations, hasReadTracking, THREAD_LIST_FIELDS } from '@/lib/communications/threads'

/**
 * Conversation list for the team inbox: one entry per contact, carrying that
 * thread's most recent message and its unread inbound count.
 */
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim().toLowerCase() ?? ''
  const filter = searchParams.get('filter') ?? 'all'

  const withRead = await hasReadTracking(supabase)
  const fields = withRead ? `${THREAD_LIST_FIELDS}, read_at` : THREAD_LIST_FIELDS

  const { data, error } = await supabase
    .from('communications')
    .select(fields)
    .not('contact_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let list = buildConversations((data ?? []) as Record<string, any>[], withRead)

  if (query) {
    list = list.filter((t) => {
      const name = `${t.contact.first_name ?? ''} ${t.contact.last_name ?? ''}`.toLowerCase()
      return (
        name.includes(query) ||
        (t.contact.email ?? '').toLowerCase().includes(query) ||
        (t.contact.phone ?? '').includes(query) ||
        t.last_message.preview.toLowerCase().includes(query)
      )
    })
  }

  if (filter === 'unread') list = list.filter((t) => t.unread > 0)

  return NextResponse.json({
    conversations: list,
    read_tracking: withRead,
    total_unread: list.reduce((n, t) => n + t.unread, 0),
  })
}

// Manual log entry (a note, or a call logged by hand). Columns are whitelisted:
// the previous version inserted the request body verbatim, which let any caller
// write to arbitrary columns.
const WRITABLE = [
  'contact_id', 'deal_id', 'type', 'direction', 'subject', 'body',
  'snippet', 'duration_secs', 'status', 'from_number', 'to_number',
  'from_email', 'to_email',
] as const

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const insert: Record<string, unknown> = {}
    for (const key of WRITABLE) {
      if (payload[key] !== undefined) insert[key] = payload[key]
    }

    if (!insert.type) return NextResponse.json({ error: 'type is required' }, { status: 400 })
    if (!insert.contact_id) return NextResponse.json({ error: 'contact_id is required' }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase.from('communications').insert(insert).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
