import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getOpenAIClient } from '@/lib/openai/client'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { website_id, seed_keyword } = await req.json()
  const admin = createAdminClient()

  const { data: website } = await admin.from('websites').select('*').eq('id', website_id).single()
  if (!website) return NextResponse.json({ error: 'Website not found' }, { status: 404 })

  const prompt = `You are an expert SEO keyword researcher specializing in ${website.industry || 'the finance industry'}.

BUSINESS CONTEXT:
- Business: ${website.name}
- Website: ${website.url}
- Industry: ${website.industry}
- Location: ${website.location || 'USA'}
- Target Audience: ${website.target_audience}
- Seed Keyword: "${seed_keyword}"

Generate a comprehensive keyword research report in JSON format:
{
  "primary_keywords": [
    {
      "keyword": "<keyword>",
      "monthly_volume": "<estimate e.g. '1K-10K'>",
      "difficulty": <0-100>,
      "intent": "informational|commercial|transactional|navigational",
      "cpc_estimate": "<e.g. $8-15>",
      "relevance": "high|medium",
      "opportunity": "high|medium|low",
      "rationale": "<why this keyword matters>"
    }
  ],
  "long_tail_keywords": [
    {
      "keyword": "<long-tail keyword>",
      "monthly_volume": "<estimate>",
      "difficulty": <0-100>,
      "intent": "<intent>",
      "rationale": "<rationale>"
    }
  ],
  "local_keywords": [
    {
      "keyword": "<location-based keyword>",
      "monthly_volume": "<estimate>",
      "difficulty": <0-100>,
      "rationale": "<rationale>"
    }
  ],
  "question_keywords": [
    {
      "question": "<what/how/why question people search>",
      "intent": "informational",
      "content_opportunity": "<suggested content piece>"
    }
  ],
  "competitor_gap_keywords": [
    {
      "keyword": "<keyword competitors rank for>",
      "difficulty": <0-100>,
      "opportunity": "<why this is an opportunity>"
    }
  ],
  "negative_keywords": [
    "<keyword to exclude from paid ads>"
  ],
  "content_topics": [
    {
      "topic": "<blog/page topic>",
      "target_keywords": ["<kw1>", "<kw2>"],
      "search_intent": "<intent>",
      "estimated_traffic_potential": "<low|medium|high>"
    }
  ],
  "summary": "<2-3 sentences on the keyword landscape and top opportunities>"
}

Return at least 8 primary keywords, 10 long-tail, 5 local, 8 question keywords.`

  const completion = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  })

  const research = JSON.parse(completion.choices[0].message.content ?? '{}')

  // Save keyword research as generated content
  await admin.from('generated_content').insert({
    website_id,
    created_by: user.id,
    type: 'keyword_research',
    title: `Keyword Research: "${seed_keyword}"`,
    content: JSON.stringify(research),
    metadata: { seed_keyword },
    status: 'draft',
  })

  // Save top keywords to tracked_keywords
  const allKws = [
    ...(research.primary_keywords || []).map((k: any) => ({ website_id, keyword: k.keyword, intent: k.intent, difficulty: k.difficulty, volume_est: k.monthly_volume })),
    ...(research.long_tail_keywords || []).slice(0, 5).map((k: any) => ({ website_id, keyword: k.keyword, intent: k.intent, difficulty: k.difficulty, volume_est: k.monthly_volume })),
  ]
  if (allKws.length) await admin.from('tracked_keywords').upsert(allKws, { onConflict: 'website_id,keyword' })

  return NextResponse.json({ research })
}
