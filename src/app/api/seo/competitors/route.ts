import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getOpenAIClient } from '@/lib/openai/client'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { website_id, competitor_url } = await req.json()
  const admin = createAdminClient()

  const { data: website } = await admin.from('websites').select('*').eq('id', website_id).single()
  if (!website) return NextResponse.json({ error: 'Website not found' }, { status: 404 })

  // Try to crawl competitor
  let competitorContent = ''
  try {
    const res = await fetch(competitor_url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()
    competitorContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)
  } catch {
    competitorContent = 'Could not crawl competitor website directly.'
  }

  const prompt = `You are an expert SEO competitive analyst. Analyze the competitive landscape for ${website.name} vs ${competitor_url}.

OUR BUSINESS:
- Name: ${website.name}
- URL: ${website.url}
- Industry: ${website.industry}
- Target Audience: ${website.target_audience}
- Current Keywords: ${(website.primary_keywords || []).join(', ')}

COMPETITOR: ${competitor_url}
COMPETITOR CONTENT SAMPLE: ${competitorContent}

Provide a comprehensive competitive analysis in JSON:
{
  "competitor_url": "${competitor_url}",
  "competitor_name": "<estimated name>",
  "overall_threat_level": "high|medium|low",
  "executive_summary": "<3-4 sentences>",
  "strengths_vs_us": [
    {"area": "<area>", "description": "<what they do better>", "our_response": "<how to counter>"}
  ],
  "weaknesses_vs_us": [
    {"area": "<area>", "description": "<where they fall short>", "opportunity": "<how we can win>"}
  ],
  "keyword_gaps": [
    {"keyword": "<keyword>", "competitor_likely_rank": "<estimate>", "difficulty": "easy|medium|hard", "action": "<what to do>"}
  ],
  "content_gaps": [
    {"topic": "<topic they cover>", "why_important": "<why>", "our_action": "<create this content>"}
  ],
  "estimated_traffic": "<estimate based on domain and content>",
  "backlink_profile": "<assessment>",
  "content_strategy": "<their apparent content strategy>",
  "differentiation_opportunities": [
    "<specific way to differentiate from this competitor>"
  ],
  "quick_wins": [
    "<actionable win to outperform this competitor fast>"
  ]
}`

  const completion = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  })

  const analysis = JSON.parse(completion.choices[0].message.content ?? '{}')

  // Save as generated content
  await admin.from('generated_content').insert({
    website_id,
    created_by: user.id,
    type: 'competitor_analysis',
    title: `Competitor Analysis: ${competitor_url}`,
    content: JSON.stringify(analysis),
    metadata: { competitor_url },
    status: 'draft',
  })

  return NextResponse.json({ analysis })
}
