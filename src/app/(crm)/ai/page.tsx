import { createServerClient } from '@/lib/supabase/server'
import AIClient from '@/components/ai/AIClient'

export default async function AIPage({ searchParams }: { searchParams: { tab?: string } }) {
  const supabase = createServerClient()

  const { data: contacts } = await supabase
    .from('contacts')
    .select(`
      id, first_name, last_name, phone, email, lead_source, created_at,
      deals(id, stage, loan_program, loan_amount, updated_at)
    `)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: adDrafts } = await supabase
    .from('ai_ad_drafts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <AIClient
      contacts={contacts ?? []}
      adDrafts={adDrafts ?? []}
      defaultTab={searchParams.tab ?? 'followup'}
    />
  )
}
