import { createServerClient } from '@/lib/supabase/server'
import PipelineBoard from '@/components/pipeline/PipelineBoard'

export const dynamic = 'force-dynamic'

export default async function PipelinePage() {
  const supabase = createServerClient()

  const [{ data: deals }, { data: profiles }, { data: stages }] = await Promise.all([
    supabase
    .from('deals')
    .select(`
      id, title, stage, loan_program, loan_amount, purchase_price, arv,
      after_repair_value, rehab_amount, credit_score, experience_level,
      under_contract, property_address, property_state, created_at, updated_at,
      contacts(id, first_name, last_name, phone, email),
      profiles:assigned_to(id, full_name)
    `)
    .order('updated_at', { ascending: false })
    .limit(200),
    supabase.from('profiles').select('id, full_name').eq('is_active', true),
    supabase.from('pipeline_stages').select('*').order('sort_order'),
  ])

  const normalizedDeals = (deals ?? []).map((deal) => ({
    ...deal,
    contacts: Array.isArray(deal.contacts) ? deal.contacts[0] ?? null : deal.contacts,
    profiles: Array.isArray(deal.profiles) ? deal.profiles[0] ?? null : deal.profiles,
  }))

  const contactIds = Array.from(new Set(normalizedDeals.map((deal) => deal.contacts?.id).filter(Boolean)))

  const { data: communications } = contactIds.length
    ? await supabase
      .from('communications')
      .select(`
        id, contact_id, deal_id, type, direction, subject, body, snippet,
        duration_secs, recording_url, transcript, ai_summary, status,
        from_number, to_number, from_email, to_email, created_at
      `)
      .in('contact_id', contactIds)
      .order('created_at', { ascending: false })
      .limit(1000)
    : { data: [] }

  return (
    <PipelineBoard
      deals={normalizedDeals}
      profiles={profiles ?? []}
      stages={stages ?? []}
      communications={communications ?? []}
    />
  )
}
