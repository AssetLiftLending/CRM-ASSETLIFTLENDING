import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/sendgrid/client'
import { sendSms } from '@/lib/twilio/client'
import { buildMergeVars, renderTemplate } from '@/lib/communications/merge'

export type AutomationAction = {
  type: 'send_sms' | 'send_email' | 'create_task'
  template?: string
  delay_minutes?: number
  delay_hours?: number
  delay_days?: number
  title?: string
  priority?: string
  due_in_days?: number
  due_in_hours?: number
  cancel_on_reply?: boolean
}

type TriggerInput = {
  trigger_type: string
  contact_id?: string | null
  deal_id?: string | null
  trigger_config?: Record<string, unknown>
  event_key?: string
}

type ActionContext = {
  contactId?: string | null
  dealId?: string | null
  vars: Record<string, string>
}

function actionDelayMinutes(action: AutomationAction) {
  return (action.delay_minutes ?? 0) +
    (action.delay_hours ?? 0) * 60 +
    (action.delay_days ?? 0) * 1440
}

async function loadContext(
  supabase: SupabaseClient,
  contactId?: string | null,
  dealId?: string | null,
): Promise<ActionContext> {
  const [{ data: contact }, { data: deal }] = await Promise.all([
    contactId
      ? supabase.from('contacts').select('*').eq('id', contactId).single()
      : Promise.resolve({ data: null }),
    dealId
      ? supabase.from('deals').select('*').eq('id', dealId).single()
      : Promise.resolve({ data: null }),
  ])

  return {
    contactId,
    dealId,
    vars: buildMergeVars(contact, null, {
      email_opt_out: contact?.email_opt_out ? 'true' : 'false',
      loan_type: deal?.loan_program?.replace(/_/g, ' ') ?? '',
      loan_program: deal?.loan_program?.replace(/_/g, ' ') ?? '',
      property_address: deal?.property_address ?? '',
    }),
  }
}

/**
 * Rebuilds merge variables from the current record before a queued action runs.
 *
 * A delayed action can sit in the queue for days. Rendering it from the variables
 * captured at queue time sends stale details, and any tag that set did not carry
 * would go out unfilled — the stored values are kept only as a fallback.
 */
export async function resolveContext(
  supabase: SupabaseClient,
  context: ActionContext,
): Promise<ActionContext> {
  if (!context.contactId && !context.dealId) return context
  const fresh = await loadContext(supabase, context.contactId, context.dealId)
  return { ...fresh, vars: { ...context.vars, ...fresh.vars } }
}

export async function executeAutomationAction(
  supabase: SupabaseClient,
  action: AutomationAction,
  context: ActionContext,
) {
  const { contactId, dealId, vars } = context

  if (action.type === 'send_sms' && vars.phone) {
    const { data: template } = await supabase
      .from('sms_templates')
      .select('body')
      .ilike('name', `%${action.template?.replace(/_/g, ' ') ?? ''}%`)
      .maybeSingle()
    const body = renderTemplate(template?.body ?? action.template ?? '', vars)
    if (!body) return { status: 'skipped', reason: 'Template is empty' }

    const message = await sendSms(vars.phone, body)
    await supabase.from('communications').insert({
      contact_id: contactId,
      deal_id: dealId,
      type: 'sms',
      direction: 'outbound',
      body,
      status: message.status,
      twilio_sid: message.sid,
      to_number: vars.phone,
    })
    return { status: 'sent', externalId: message.sid }
  }

  if (action.type === 'send_email' && vars.email && vars.email_opt_out !== 'true') {
    const { data: template } = await supabase
      .from('email_templates')
      .select('subject, html_body, text_body')
      .ilike('name', `%${action.template?.replace(/_/g, ' ') ?? ''}%`)
      .maybeSingle()
    if (!template) return { status: 'skipped', reason: 'Template not found' }

    const subject = renderTemplate(template.subject, vars)
    const html = renderTemplate(template.html_body, vars)
    const text = template.text_body ? renderTemplate(template.text_body, vars) : undefined
    const result = await sendEmail({ to: vars.email, subject, html, text })
    await supabase.from('communications').insert({
      contact_id: contactId,
      deal_id: dealId,
      type: 'email',
      direction: 'outbound',
      subject,
      body: html,
      snippet: (text ?? html.replace(/<[^>]+>/g, '')).slice(0, 200),
      status: 'processed',
      sendgrid_id: result.messageId,
      from_email: process.env.SENDGRID_FROM_EMAIL,
      to_email: vars.email,
    })
    return { status: 'sent', externalId: result.messageId }
  }

  if (action.type === 'create_task') {
    const dueDate = action.due_in_days
      ? new Date(Date.now() + action.due_in_days * 86400000).toISOString()
      : action.due_in_hours
        ? new Date(Date.now() + action.due_in_hours * 3600000).toISOString()
        : null
    const { data, error } = await supabase.from('tasks').insert({
      title: renderTemplate(action.title ?? 'Follow up', vars),
      priority: action.priority ?? 'medium',
      due_date: dueDate,
      contact_id: contactId || null,
      deal_id: dealId || null,
    }).select('id').single()
    if (error) throw error
    return { status: 'created', externalId: data.id }
  }

  return { status: 'skipped', reason: 'Recipient is missing' }
}

export async function triggerAutomations(supabase: SupabaseClient, input: TriggerInput) {
  const { data: automations, error } = await supabase
    .from('automations')
    .select('*')
    .eq('trigger_type', input.trigger_type)
    .eq('is_active', true)
  if (error) throw error
  if (!automations?.length) return { triggered: 0, queued: 0 }

  const context = await loadContext(supabase, input.contact_id, input.deal_id)
  const eventKey = input.event_key ?? crypto.randomUUID()
  let triggered = 0
  let queued = 0

  for (const automation of automations) {
    const config = automation.trigger_config ?? {}
    if (config.to_stage && config.to_stage !== input.trigger_config?.to_stage) continue

    const actions = (automation.actions ?? []) as AutomationAction[]
    const results: unknown[] = []
    let failedActions = 0

    for (const [index, action] of actions.entries()) {
      const delayMinutes = actionDelayMinutes(action)
      // One bad action must not abandon the actions that follow it, nor the
      // remaining automations. Record the failure and keep going.
      try {
        if (delayMinutes > 0) {
          const { error: queueError } = await supabase.from('scheduled_automation_actions').upsert({
            automation_id: automation.id,
            contact_id: input.contact_id || null,
            deal_id: input.deal_id || null,
            action,
            variables: context.vars,
            run_at: new Date(Date.now() + delayMinutes * 60000).toISOString(),
            dedupe_key: `${eventKey}:${automation.id}:${index}`,
            cancel_on_reply: action.cancel_on_reply ?? action.type !== 'create_task',
          }, { onConflict: 'dedupe_key', ignoreDuplicates: true })
          if (queueError) throw queueError
          queued++
          results.push({ status: 'queued', delayMinutes })
        } else {
          results.push(await executeAutomationAction(supabase, action, context))
          triggered++
        }
      } catch (actionError) {
        failedActions++
        const message = actionError instanceof Error ? actionError.message : 'Unknown action failure'
        console.error(
          `Automation ${automation.id} action ${index} (${action.type}) failed:`,
          message
        )
        results.push({ status: 'failed', type: action.type, error: message })
      }
    }

    // Report what actually happened rather than always claiming success.
    const status = failedActions === 0
      ? 'success'
      : failedActions === actions.length ? 'failed' : 'partial'

    await supabase.from('automation_logs').insert({
      automation_id: automation.id,
      contact_id: input.contact_id || null,
      deal_id: input.deal_id || null,
      status,
      result: results,
    })
    await supabase.from('automations')
      .update({ run_count: (automation.run_count ?? 0) + 1, last_run_at: new Date().toISOString() })
      .eq('id', automation.id)
  }

  return { triggered, queued }
}

export function scheduledActionContext(row: Record<string, any>): ActionContext {
  return { contactId: row.contact_id, dealId: row.deal_id, vars: row.variables ?? {} }
}
