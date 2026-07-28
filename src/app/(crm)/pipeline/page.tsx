import { createServerClient } from '@/lib/supabase/server'
import PipelineBoard from '@/components/pipeline/PipelineBoard'

export default async function PipelinePage() {
  const supabase = createServerClient()

  const { data: deals } = await supabase
    .from('deals')
    .select(`
      id, title, stage, loan_program, loan_amount, purchase_price, arv,
      after_repair_value, rehab_amount, credit_score, experience_level,
      under_contract, property_address, property_state, created_at, updated_at,
      contacts(id, first_name, last_name, phone, email),
      profiles:assigned_to(id, full_name)
    `)
    .order('updated_at', { ascending: false })
    .limit(200)

  const { data: profiles } = await supabase
    .from('profiles').select('id, full_name').eq('is_active', true)

  const normalizedDeals = (deals ?? []).map((deal) => ({
    ...deal,
    contacts: Array.isArray(deal.contacts) ? deal.contacts[0] ?? null : deal.contacts,
    profiles: Array.isArray(deal.profiles) ? deal.profiles[0] ?? null : deal.profiles,
  }))

  return <PipelineBoard deals={normalizedDeals} profiles={profiles ?? []} />
}
