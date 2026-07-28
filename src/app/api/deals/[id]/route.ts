import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body    = await req.json()
    const supabase = createAdminClient()

    // Get current deal stage before update (for automation triggers)
    const { data: currentDeal } = await supabase
      .from('deals')
      .select('stage, contact_id')
      .eq('id', params.id)
      .single()

    const { data, error } = await supabase
      .from('deals')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    // Fire stage_changed automation if stage changed
    if (body.stage && currentDeal && body.stage !== currentDeal.stage) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/automations/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger_type: 'stage_changed',
          contact_id: currentDeal.contact_id,
          deal_id: params.id,
          from_stage: currentDeal.stage,
          to_stage: body.stage,
          trigger_config: { to_stage: body.stage },
        }),
      }).catch(() => {})

      // Special: deal_funded / closed deal
      if (body.stage === 'closed_deal' || body.stage === 'funded') {
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/automations/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trigger_type: 'deal_funded',
            contact_id: currentDeal.contact_id,
            deal_id: params.id,
          }),
        }).catch(() => {})
      }
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('PATCH /api/deals/[id]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('deals')
    .select(`
      *,
      contacts(*),
      profiles:assigned_to(id, full_name)
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}
