import { createServerClient } from '@/lib/supabase/server'
import CommunicationsClient from '@/components/communications/CommunicationsClient'

export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: { tab?: string; contact?: string }
}) {
  const supabase = createServerClient()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, email, whatsapp')
    .eq('is_archived', false)
    .order('first_name')
    .limit(500)

  const { data: recentComms } = await supabase
    .from('communications')
    .select(`
      id, type, direction, body, subject, duration_secs, recording_url, ai_summary,
      status, created_at, from_number, to_number, from_email, to_email,
      contacts(id, first_name, last_name)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: smsTemplates } = await supabase
    .from('sms_templates')
    .select('id, name, body, category')

  const { data: emailTemplates } = await supabase
    .from('email_templates')
    .select('id, name, subject, html_body, category')

  const normalizedComms = (recentComms ?? []).map((comm) => ({
    ...comm,
    contacts: Array.isArray(comm.contacts) ? comm.contacts[0] ?? null : comm.contacts,
  }))

  return (
    <CommunicationsClient
      contacts={contacts ?? []}
      recentComms={normalizedComms}
      smsTemplates={smsTemplates ?? []}
      emailTemplates={emailTemplates ?? []}
      defaultTab={searchParams.tab ?? 'feed'}
      defaultContact={searchParams.contact}
    />
  )
}
