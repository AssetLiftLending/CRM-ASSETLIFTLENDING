import { createAdminClient } from '@/lib/supabase/server'
import { buildConversations, hasReadTracking, THREAD_LIST_FIELDS } from '@/lib/communications/threads'
import { channelStatus } from '@/lib/communications/channels'
import ConversationsClient from '@/components/communications/ConversationsClient'

export const dynamic = 'force-dynamic'

interface Template {
  id: string
  name: string
  body?: string | null
  subject?: string | null
  html_body?: string | null
}

export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>
}) {
  const { contact } = await searchParams
  const channels = channelStatus()

  let conversations: Awaited<ReturnType<typeof buildConversations>> = []
  let readTracking = false
  let loadError: string | null = null
  let smsTemplates: Template[] = []
  let emailTemplates: Template[] = []

  // The inbox must still render when the database is unreachable — an empty
  // shell with the reason beats a crashed page.
  try {
    const supabase = createAdminClient()
    readTracking = await hasReadTracking(supabase)

    const [{ data, error }, { data: sms }, { data: email }] = await Promise.all([
      supabase
        .from('communications')
        .select(readTracking ? `${THREAD_LIST_FIELDS}, read_at` : THREAD_LIST_FIELDS)
        .not('contact_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(2000),
      supabase.from('sms_templates').select('id, name, body'),
      supabase.from('email_templates').select('id, name, subject, html_body'),
    ])

    if (error) throw new Error(error.message)
    conversations = buildConversations((data ?? []) as Record<string, any>[], readTracking)
    smsTemplates = sms ?? []
    emailTemplates = email ?? []
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Could not load conversations.'
    console.error('CommunicationsPage', err)
  }

  return (
    <ConversationsClient
      initialConversations={conversations}
      channels={channels}
      readTracking={readTracking}
      defaultContact={contact}
      loadError={loadError}
      smsTemplates={smsTemplates}
      emailTemplates={emailTemplates}
    />
  )
}
