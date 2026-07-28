import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendSms, interpolate } from '@/lib/twilio/client'
import { sendEmail, interpolateEmail } from '@/lib/sendgrid/client'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { trigger_type, contact_id, deal_id, trigger_config = {} } = body
    const supabase = createAdminClient()

    // Get matching active automations
    const { data: automations } = await supabase
      .from('automations')
      .select('*')
      .eq('trigger_type', trigger_type)
      .eq('is_active', true)

    if (!automations?.length) return NextResponse.json({ triggered: 0 })

    // Get contact info for variable substitution
    const { data: contact } = contact_id
      ? await supabase.from('contacts').select('*').eq('id', contact_id).single()
      : { data: null }

    const { data: deal } = deal_id
      ? await supabase.from('deals').select('*').eq('id', deal_id).single()
      : { data: null }

    const vars: Record<string, string> = {
      first_name:    contact?.first_name ?? '',
      last_name:     contact?.last_name  ?? '',
      contact_name:  `${contact?.first_name ?? ''} ${contact?.last_name ?? ''}`.trim(),
      phone:         contact?.phone ?? '',
      loan_type:     deal?.loan_program?.replace(/_/g, ' ') ?? '',
      portal_url:    `${process.env.NEXT_PUBLIC_APP_URL}/portal`,
      agent_name:    'Asset Lift Lending',
      doc_name:      'documents',
      date:          new Date().toLocaleDateString(),
      time:          new Date().toLocaleTimeString(),
    }

    let triggered = 0

    for (const automation of automations) {
      // Check trigger_config matches (e.g. to_stage)
      const cfg = automation.trigger_config ?? {}
      if (cfg.to_stage && cfg.to_stage !== trigger_config.to_stage) continue

      const actions: Array<{ type: string; template?: string; delay_minutes?: number; delay_days?: number; delay_hours?: number; title?: string; priority?: string; due_in_days?: number; due_in_hours?: number }> = automation.actions ?? []

      for (const action of actions) {
        // For now, process delay=0 actions immediately; delayed actions would use a queue
        const delayMins = (action.delay_minutes ?? 0) +
          (action.delay_hours ?? 0) * 60 +
          (action.delay_days ?? 0) * 1440

        if (delayMins > 5) {
          // TODO: queue delayed actions (use Supabase edge functions or a queue)
          continue
        }

        try {
          if (action.type === 'send_sms' && contact?.phone) {
            // Find template
            const { data: tmpl } = await supabase
              .from('sms_templates')
              .select('body')
              .eq('name', action.template?.replace(/_/g, ' ') ?? '')
              .single()
            const body = tmpl?.body ?? action.template ?? ''
            if (body) {
              const msg = await sendSms(contact.phone, interpolate(body, vars))
              await supabase.from('communications').insert({
                contact_id, type: 'sms', direction: 'outbound',
                body: interpolate(body, vars), status: msg.status, twilio_sid: msg.sid,
              })
            }
          }

          if (action.type === 'send_email' && contact?.email) {
            const { data: tmpl } = await supabase
              .from('email_templates')
              .select('subject, html_body')
              .ilike('name', `%${action.template?.replace(/_/g, ' ') ?? ''}%`)
              .single()
            if (tmpl) {
              const html = interpolateEmail(tmpl.html_body, vars)
              await sendEmail({ to: contact.email, subject: interpolate(tmpl.subject, vars), html })
              await supabase.from('communications').insert({
                contact_id, type: 'email', direction: 'outbound',
                subject: interpolate(tmpl.subject, vars), body: html, status: 'sent',
                from_email: process.env.SENDGRID_FROM_EMAIL, to_email: contact.email,
              })
            }
          }

          if (action.type === 'create_task') {
            const dueDate = action.due_in_days
              ? new Date(Date.now() + action.due_in_days * 86400000).toISOString()
              : action.due_in_hours
              ? new Date(Date.now() + action.due_in_hours * 3600000).toISOString()
              : null
            await supabase.from('tasks').insert({
              title:      interpolate(action.title ?? 'Follow up', vars),
              priority:   action.priority ?? 'medium',
              due_date:   dueDate,
              contact_id: contact_id || null,
              deal_id:    deal_id || null,
            })
          }

          triggered++
        } catch (e) {
          console.error('Automation action error:', e)
        }
      }

      // Log automation run
      await supabase.from('automation_logs').insert({
        automation_id: automation.id,
        contact_id:    contact_id || null,
        deal_id:       deal_id || null,
        status:        'success',
      })

      // Update run count
      await supabase.from('automations')
        .update({ run_count: (automation.run_count ?? 0) + 1, last_run_at: new Date().toISOString() })
        .eq('id', automation.id)
    }

    return NextResponse.json({ triggered })
  } catch (err) {
    console.error('Automation trigger error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
