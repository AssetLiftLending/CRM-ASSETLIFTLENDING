import { createServerClient } from '@/lib/supabase/server'
import ReportsClient from '@/components/reports/ReportsClient'

export default async function ReportsPage() {
  const supabase = createServerClient()

  // All deals with stage + dates
  const { data: deals } = await supabase
    .from('deals')
    .select('id,stage,loan_program,loan_amount,lead_source,created_at,close_date_actual,funded_amount')
    .order('created_at', { ascending: false })

  // All contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id,lead_source,created_at')

  // Communications count
  const { data: comms } = await supabase
    .from('communications')
    .select('id,type,direction,created_at')

  // Ad campaigns
  const { data: adCampaigns } = await supabase
    .from('ad_campaigns')
    .select('*')
    .order('date_start', { ascending: false })
    .limit(20)

  return (
    <ReportsClient
      deals={deals ?? []}
      contacts={contacts ?? []}
      comms={comms ?? []}
      adCampaigns={adCampaigns ?? []}
    />
  )
}
