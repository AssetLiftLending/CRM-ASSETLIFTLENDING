import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { parseMetaLead } from '@/lib/ads/meta'
import { triggerAutomations } from '@/lib/automations/engine'

// Meta Lead Ads webhook — instant lead ingestion
export async function GET(req: NextRequest) {
  // Webhook verification
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = createAdminClient()

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'leadgen') continue

        const leadId   = change.value.leadgen_id
        const formId   = change.value.form_id
        const adId     = change.value.ad_id
        const campaignId = change.value.campaign_id

        // Fetch full lead data from Meta
        const metaRes = await fetch(
          `https://graph.facebook.com/v20.0/${leadId}?fields=id,created_time,field_data&access_token=${process.env.META_ACCESS_TOKEN}`
        )
        const leadData = await metaRes.json()

        const contact = parseMetaLead({
          ...leadData,
          lead_source_detail: { meta_lead_id: leadId, form_id: formId, ad_id: adId, campaign_id: campaignId },
        })

        // Upsert contact (avoid dupes). maybeSingle() so that "no match" is not
        // an error, and skip the lookup entirely when Meta gave us no email —
        // .eq('email', undefined) would match arbitrary rows.
        const { data: existing } = contact.email
          ? await supabase
              .from('contacts')
              .select('id')
              .eq('email', contact.email)
              .limit(1)
              .maybeSingle()
          : { data: null }

        let contactId = existing?.id
        if (!existing && (contact.email || contact.phone)) {
          const { data: newContact } = await supabase
            .from('contacts')
            .insert({ ...contact, lead_source: 'meta_ad' })
            .select('id')
            .single()
          contactId = newContact?.id
        }

        if (contactId) {
          // Create deal
          await supabase.from('deals').insert({
            contact_id: contactId, stage: 'new_lead', loan_program: 'fix_flip',
            lead_source: 'meta_ad',
            lead_source_detail: contact.lead_source_detail,
          })

          // Never let an automation failure fail the webhook: Meta retries on a
          // non-2xx response, which would re-ingest the same lead repeatedly.
          try {
            await triggerAutomations(supabase, {
              trigger_type: 'lead_created',
              contact_id: contactId,
              event_key: `meta-lead:${leadId}`,
            })
          } catch (err) {
            console.error('Meta webhook: automations failed for contact', contactId, err)
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Meta webhook error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
