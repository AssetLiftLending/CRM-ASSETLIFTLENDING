import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { triggerAutomations } from '@/lib/automations/engine'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body    = await req.json()
    const supabase = createAdminClient()

    // Get current deal stage before update (for automation triggers)
    const { data: currentDeal } = await supabase
      .from('deals')
      .select('stage, contact_id')
      .eq('id', id)
      .single()

    const { data, error } = await supabase
      .from('deals')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Fire stage_changed automation if stage changed
    if (body.stage && currentDeal && body.stage !== currentDeal.stage) {
      await triggerAutomations(supabase, {
        trigger_type: 'stage_changed',
        contact_id: currentDeal.contact_id,
        deal_id: id,
        trigger_config: { to_stage: body.stage },
        event_key: `stage:${id}:${body.stage}:${data.updated_at}`,
      })

      // Special: deal_funded / closed deal
      if (body.stage === 'closed_deal' || body.stage === 'funded') {
        await triggerAutomations(supabase, {
          trigger_type: 'deal_funded',
          contact_id: currentDeal.contact_id,
          deal_id: id,
          event_key: `funded:${id}:${data.updated_at}`,
        })
      }
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('PATCH /api/deals/[id]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('deals')
    .select(`
      *,
      contacts(*),
      profiles:assigned_to(id, full_name)
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}
