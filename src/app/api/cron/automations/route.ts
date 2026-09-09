import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { executeAutomationAction, resolveContext, scheduledActionContext } from '@/lib/automations/engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: actions, error } = await supabase.rpc('claim_scheduled_automation_actions', { batch_size: 25 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let completed = 0
  let failed = 0
  for (const row of actions ?? []) {
    try {
      const context = await resolveContext(supabase, scheduledActionContext(row))
      const result = await executeAutomationAction(supabase, row.action, context)
      await supabase.from('scheduled_automation_actions').update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        result,
        last_error: null,
      }).eq('id', row.id)
      completed++
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'Unknown action failure'
      const exhausted = row.attempts >= row.max_attempts
      await supabase.from('scheduled_automation_actions').update({
        status: exhausted ? 'failed' : 'pending',
        run_at: exhausted ? row.run_at : new Date(Date.now() + Math.min(60, 2 ** row.attempts) * 60000).toISOString(),
        last_error: message,
      }).eq('id', row.id)
      failed++
    }
  }

  return NextResponse.json({ claimed: actions?.length ?? 0, completed, failed })
}
