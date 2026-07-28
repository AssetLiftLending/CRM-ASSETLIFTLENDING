// Meta Marketing API integration

const META_API_BASE = 'https://graph.facebook.com/v20.0'
const ACCESS_TOKEN  = process.env.META_ACCESS_TOKEN
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID

async function metaFetch(path: string, opts?: RequestInit) {
  const url = path.startsWith('http') ? path : `${META_API_BASE}${path}`
  const separator = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${separator}access_token=${ACCESS_TOKEN}`, opts)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta API error: ${JSON.stringify(err)}`)
  }
  return res.json()
}

// Pull new leads from Meta Lead Forms
export async function fetchMetaLeads(pageId: string, formId: string, since?: string) {
  const sinceParam = since ? `&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${since}}]` : ''
  const data = await metaFetch(`/${formId}/leads?fields=id,created_time,field_data${sinceParam}`)
  return data.data ?? []
}

// Get all lead forms for the connected page
export async function getLeadForms(pageId: string) {
  const data = await metaFetch(`/${pageId}/leadgen_forms?fields=id,name,status,leads_count`)
  return data.data ?? []
}

// Get campaign performance stats
export async function getCampaignStats(datePreset = 'last_30d') {
  const data = await metaFetch(
    `/${AD_ACCOUNT_ID}/campaigns?fields=id,name,status,objective,insights{spend,impressions,clicks,cpm,cpp,cpc,reach}&date_preset=${datePreset}`
  )
  return data.data ?? []
}

// Get ad account spend summary
export async function getAdAccountInsights(datePreset = 'last_30d') {
  const data = await metaFetch(
    `/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,clicks,cpm,cpp,cpc,reach,actions&date_preset=${datePreset}`
  )
  return data.data?.[0] ?? {}
}

// Create ad (after approval) — requires pre-existing campaign/adset
export async function createMetaAd({
  adSetId,
  name,
  creativeId,
  status = 'PAUSED',
}: {
  adSetId: string
  name: string
  creativeId: string
  status?: 'PAUSED' | 'ACTIVE'
}) {
  return metaFetch(`/${AD_ACCOUNT_ID}/ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, adset_id: adSetId, creative: { creative_id: creativeId }, status }),
  })
}

// Parse lead form fields into contact object
export function parseMetaLead(lead: Record<string, unknown>) {
  const fields: Record<string, string> = {}
  const fieldData = lead.field_data as Array<{ name: string; values: string[] }> ?? []
  fieldData.forEach((f) => { fields[f.name] = f.values?.[0] ?? '' })

  return {
    first_name:    fields['first_name']   ?? fields['full_name']?.split(' ')[0] ?? '',
    last_name:     fields['last_name']    ?? fields['full_name']?.split(' ')[1] ?? '',
    email:         fields['email']        ?? '',
    phone:         fields['phone_number'] ?? fields['phone'] ?? '',
    lead_source:   'meta_ad',
    lead_source_detail: {
      meta_lead_id: lead.id,
      created_time: lead.created_time,
    },
  }
}
