import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createAdminClient()

  const [
    { data: deals },
    { data: contacts },
    { data: adCampaigns },
  ] = await Promise.all([
    supabase.from('deals').select('stage, loan_program, lead_source, created_at, loan_amount'),
    supabase.from('contacts').select('lead_source, created_at'),
    supabase.from('ad_campaigns').select('platform, spend, impressions, clicks, leads, created_at'),
  ])

  // Pipeline by stage
  const byStage = (deals ?? []).reduce((acc: Record<string, number>, d) => {
    acc[d.stage] = (acc[d.stage] ?? 0) + 1
    return acc
  }, {})

  // Leads by source
  const bySource = (contacts ?? []).reduce((acc: Record<string, number>, c) => {
    const src = c.lead_source ?? 'unknown'
    acc[src] = (acc[src] ?? 0) + 1
    return acc
  }, {})

  // Funded deals
  const funded = (deals ?? []).filter(d => d.stage === 'funded')
  const totalFunded = funded.reduce((sum, d) => sum + (d.loan_amount ?? 0), 0)

  // Ad ROI
  const roiByPlatform = (adCampaigns ?? []).reduce((acc: Record<string, any>, c) => {
    if (!acc[c.platform]) acc[c.platform] = { spend: 0, leads: 0, clicks: 0 }
    acc[c.platform].spend  += c.spend  ?? 0
    acc[c.platform].leads  += c.leads  ?? 0
    acc[c.platform].clicks += c.clicks ?? 0
    return acc
  }, {})

  return NextResponse.json({
    byStage,
    bySource,
    totalDeals: (deals ?? []).length,
    totalFunded,
    fundedCount: funded.length,
    roiByPlatform,
  })
}
