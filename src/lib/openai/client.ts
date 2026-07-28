import OpenAI from 'openai'

export const getOpenAIClient = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── AD COPY GENERATION ─────────────────────────────────────

export async function generateAdCopy({
  platform,
  loanProgram,
  targetAudience,
  goal,
  budget,
  geography,
}: {
  platform: 'meta' | 'google'
  loanProgram: string
  targetAudience: string
  goal: string
  budget?: string
  geography?: string
}) {
  const systemPrompt = `You are an expert direct-response copywriter specializing in private lending ads for real estate investors.
You write high-converting ads for fix-and-flip, DSCR, ground-up construction, commercial, and multifamily bridge loans.
Your ads are for Asset Lift Lending — a private lender that closes fast, has flexible underwriting, and serves experienced investors.
Always focus on speed, simplicity, and deal outcomes. Use investor language, not retail mortgage language.`

  const userPrompt = platform === 'meta'
    ? `Create 3 Meta Ad variations for the following:
- Loan Program: ${loanProgram}
- Target Audience: ${targetAudience}
- Campaign Goal: ${goal}
- Geography: ${geography ?? 'Nationwide'}

For each variation provide:
1. PRIMARY TEXT (up to 125 chars — punchy, investor-focused)
2. HEADLINE (40 chars max)
3. DESCRIPTION (25 chars max)
4. CTA button text (one of: Learn More, Apply Now, Get Quote, Contact Us)
5. TARGETING SUGGESTION (interests, behaviors, lookalike)

Format as JSON array with fields: primary_text, headline, description, cta, targeting, predicted_strength (1-10)`

    : `Create a Google Responsive Search Ad for:
- Loan Program: ${loanProgram}
- Target Audience: ${targetAudience}
- Goal: ${goal}

Provide:
- 15 HEADLINES (30 chars each, keyword-rich)
- 4 DESCRIPTIONS (90 chars each)
- Top 5 KEYWORDS to bid on (with match type)
- Negative keywords to exclude

Format as JSON with fields: headlines (array), descriptions (array), keywords (array of {keyword, match_type}), negatives (array)`

  const res = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.8,
  })

  return JSON.parse(res.choices[0].message.content ?? '{}')
}

// ── FOLLOW-UP MESSAGE DRAFT ────────────────────────────────

export async function draftFollowUpMessage({
  contactName,
  loanProgram,
  lastContactDate,
  lastMessage,
  stage,
  medium,
}: {
  contactName: string
  loanProgram: string
  lastContactDate: string
  lastMessage?: string
  stage: string
  medium: 'sms' | 'email' | 'whatsapp'
}) {
  const prompt = `Draft a ${medium} follow-up message for a private lending CRM.

Contact: ${contactName}
Loan Program: ${loanProgram}
Pipeline Stage: ${stage}
Last Contact: ${lastContactDate}
Last Message Context: ${lastMessage ?? 'No prior message'}
Medium: ${medium === 'sms' || medium === 'whatsapp' ? 'text message (keep under 160 chars, casual and direct)' : 'email (professional but warm, 3-4 sentences max)'}

From: Asset Lift Lending (private lender for real estate investors)

Write 2 variations. Return JSON: { variations: [{subject?: string, body: string, tone: string}] }`

  const res = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.9,
  })

  return JSON.parse(res.choices[0].message.content ?? '{}')
}

// ── CALL SCRIPT SUGGESTIONS ────────────────────────────────

export async function generateCallScript({
  contactName,
  loanProgram,
  dealSummary,
  stage,
  callHistory,
}: {
  contactName: string
  loanProgram: string
  dealSummary: string
  stage: string
  callHistory: string
}) {
  const res = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: `Create a brief call script / talking points for a loan officer at Asset Lift Lending calling ${contactName}.

Deal: ${dealSummary}
Program: ${loanProgram}
Stage: ${stage}
History: ${callHistory}

Return JSON: {
  opening: string,
  key_points: string[],
  objection_handlers: [{objection: string, response: string}],
  closing: string,
  next_step_suggestion: string
}`
    }],
    response_format: { type: 'json_object' },
  })

  return JSON.parse(res.choices[0].message.content ?? '{}')
}
