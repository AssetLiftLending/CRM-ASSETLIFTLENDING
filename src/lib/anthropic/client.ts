import Anthropic from '@anthropic-ai/sdk'

export const getAnthropicClient = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── PRIORITY SCORING ───────────────────────────────────────

export async function scoreFollowUpPriority(leads: Array<{
  id: string
  name: string
  stage: string
  loan_program: string
  last_contact_days: number
  email_opens: number
  sms_replies: number
  deal_value: number
  documents_submitted: number
}>) {
  const res = await getAnthropicClient().messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are a private lending sales coach. Score these leads 1-10 for follow-up priority today.

Factors to weigh:
- Days since last contact (longer = higher priority, but not infinite)
- Stage (in_progress > contacted > new_inquiry > just_searching)
- Email opens and SMS replies (shows engagement)
- Deal value (larger deals worth more attention)
- Documents submitted (closer to close = higher priority)

Leads:
${JSON.stringify(leads, null, 2)}

Return JSON: {
  scored: [{
    id: string,
    score: number,
    reason: string (1 sentence),
    suggested_action: string,
    suggested_medium: "call" | "sms" | "email"
  }]
}
Sort by score descending.`
    }],
  })

  const text = res.content[0].type === 'text' ? res.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  return jsonMatch ? JSON.parse(jsonMatch[0]) : { scored: [] }
}

// ── CALL SUMMARY ───────────────────────────────────────────

export async function summarizeCall(transcript: string, contactName: string) {
  const res = await getAnthropicClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Summarize this loan officer call with ${contactName} for a private lending CRM.

Transcript:
${transcript}

Return JSON: {
  summary: string (2-3 sentences — what was discussed, borrower interest level),
  key_facts: string[] (max 5 — loan amount, property, timeline, objections, etc.),
  next_action: string (specific next step),
  sentiment: "positive" | "neutral" | "negative" | "not_interested"
}`
    }],
  })

  const text = res.content[0].type === 'text' ? res.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  return jsonMatch ? JSON.parse(jsonMatch[0]) : {}
}

// ── DEAL RISK ANALYSIS ─────────────────────────────────────

export async function analyzeDealRisk(deal: {
  loan_program: string
  purchase_price: number
  arv: number
  rehab_amount: number
  loan_amount: number
  credit_score: number
  experience_count: number
  property_state: string
}) {
  const ltv = deal.loan_amount / deal.arv * 100

  const res = await getAnthropicClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Analyze this private lending deal for risk. Be concise.

Deal: ${JSON.stringify(deal, null, 2)}
Calculated LTV: ${ltv.toFixed(1)}%

Return JSON: {
  risk_level: "low" | "medium" | "high",
  flags: string[] (specific concerns),
  strengths: string[] (positive factors),
  recommendation: string (1 sentence)
}`
    }],
  })

  const text = res.content[0].type === 'text' ? res.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  return jsonMatch ? JSON.parse(jsonMatch[0]) : {}
}
