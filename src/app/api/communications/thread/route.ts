import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { hasReadTracking } from '@/lib/communications/threads'

const FIELDS =
  'id, contact_id, deal_id, type, direction, subject, body, snippet, status, ' +
  'duration_secs, recording_url, transcript, ai_summary, voicemail, ' +
  'from_number, to_number, from_email, to_email, created_at'

/** Full message history for one contact, oldest first, the way a thread reads. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get('contact_id')
  if (!contactId) {
    return NextResponse.json({ error: 'contact_id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const withRead = await hasReadTracking(supabase)

  const [{ data: contact, error: contactError }, { data: messages, error: msgError }] =
    await Promise.all([
      supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, cell_phone, whatsapp, stage, lead_source, created_at')
        .eq('id', contactId)
        .maybeSingle(),
      supabase
        .from('communications')
        .select(withRead ? `${FIELDS}, read_at` : FIELDS)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: true })
        .limit(1000),
    ])

  if (contactError) return NextResponse.json({ error: contactError.message }, { status: 500 })
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 })

  return NextResponse.json({
    contact,
    messages: messages ?? [],
    read_tracking: withRead,
  })
}

/** Mark a thread's inbound messages as read. No-op until the migration lands. */
export async function POST(req: NextRequest) {
  const { contact_id: contactId } = await req.json()
  if (!contactId) {
    return NextResponse.json({ error: 'contact_id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  if (!(await hasReadTracking(supabase))) {
    return NextResponse.json({ marked: 0, read_tracking: false })
  }

  const { data, error } = await supabase
    .from('communications')
    .update({ read_at: new Date().toISOString() })
    .eq('contact_id', contactId)
    .eq('direction', 'inbound')
    .is('read_at', null)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ marked: data?.length ?? 0, read_tracking: true })
}
