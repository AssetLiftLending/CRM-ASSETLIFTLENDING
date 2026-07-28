import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getOpenAIClient } from '@/lib/openai/client'

const CONTENT_PROMPTS: Record<string, (w: any, opts: any) => string> = {
  blog_post: (w, o) => `Write a comprehensive, SEO-optimized blog post for ${w.name} (${w.url}).

BUSINESS: ${w.industry} serving ${w.target_audience}
TOPIC: ${o.topic}
TARGET KEYWORD: ${o.keyword || o.topic}
WORD COUNT: 1200-1800 words
TONE: Professional, authoritative, helpful

Requirements:
- SEO-optimized title with target keyword
- Compelling introduction with keyword in first 100 words
- 4-6 H2 sections with relevant H3 subheadings
- Include real facts, tips, and actionable advice
- Natural keyword usage (2-3% density)
- Strong call-to-action mentioning ${w.name}
- Meta title (≤60 chars) and meta description (≤160 chars) at the end

Format as JSON: { "meta_title": "...", "meta_description": "...", "title": "...", "content": "<full blog post in markdown>", "word_count": <n>, "target_keywords": ["kw1","kw2"] }`,

  social_instagram: (w, o) => `Write 3 Instagram post variations for ${w.name} about: "${o.topic}"

Business: ${w.industry} | Audience: ${w.target_audience}
Each post should be engaging, use emojis, have 5-10 relevant hashtags, and include a call-to-action.

JSON format: { "posts": [{ "caption": "...", "hashtags": ["#tag"], "cta": "..." }] }`,

  social_facebook: (w, o) => `Write 3 Facebook post variations for ${w.name} about: "${o.topic}"

Business: ${w.industry} | Audience: ${w.target_audience}
Each post should be 2-4 sentences, conversational, with a clear CTA. Include a mix of: educational, promotional, and engagement-focused posts.

JSON: { "posts": [{ "text": "...", "cta": "...", "post_type": "educational|promotional|engagement" }] }`,

  social_linkedin: (w, o) => `Write a professional LinkedIn post for ${w.name} about: "${o.topic}"

Industry: ${w.industry} | Audience: professionals, investors
Make it 150-300 words, thought-leadership oriented, with industry insights and subtle promotion. End with a question to drive engagement.

JSON: { "post": "...", "hashtags": ["#tag1","#tag2"] }`,

  social_twitter: (w, o) => `Write 5 tweet variations for ${w.name} about: "${o.topic}"

Each tweet max 280 chars. Mix of: hook tweets, tip tweets, question tweets, and promotional tweets.

JSON: { "tweets": [{ "text": "...", "type": "hook|tip|question|promo" }] }`,

  email_newsletter: (w, o) => `Write a complete email newsletter for ${w.name}.

TOPIC: ${o.topic}
AUDIENCE: ${w.target_audience}
PURPOSE: ${o.purpose || 'Nurture leads and provide value'}

Include: subject line (with A/B variant), preview text, greeting, intro, 2-3 content sections with headers, CTA button text, and closing.

JSON: {
  "subject_line": "...",
  "subject_line_b": "...",
  "preview_text": "...",
  "body": "...",
  "cta_text": "...",
  "cta_url": "..."
}`,

  email_sequence: (w, o) => `Write a 5-email nurture sequence for ${w.name}.

GOAL: ${o.goal || 'Convert leads into borrowers'}
AUDIENCE: ${w.target_audience}
SEQUENCE THEME: ${o.topic}

Each email should build on the previous. Include send timing suggestions.

JSON: { "emails": [{ "day": <n>, "subject": "...", "preview": "...", "body": "...", "cta": "..." }] }`,

  google_ad: (w, o) => `Create 3 complete Google Search Ad campaigns for ${w.name}.

KEYWORD: ${o.keyword}
LANDING PAGE: ${w.url}
GOAL: ${o.goal || 'Generate leads'}

For each ad: 3 headlines (≤30 chars each), 2 descriptions (≤90 chars each), and 4 sitelink extensions.

JSON: { "ads": [{ "headlines": ["h1","h2","h3"], "descriptions": ["d1","d2"], "sitelinks": [{"text":"...","desc":"...","url":"..."}] }], "recommended_bid_strategy": "...", "match_types": ["..."] }`,

  meta_ad: (w, o) => `Create complete Meta (Facebook/Instagram) ad copy for ${w.name}.

CAMPAIGN GOAL: ${o.goal || 'Lead generation'}
TARGET: ${w.target_audience}
TOPIC: ${o.topic}

Create 3 ad variations (story/feed/reel). Each with: primary text, headline, description, and CTA button. Include audience targeting suggestions.

JSON: { "ads": [{ "format": "feed|story|reel", "primary_text": "...", "headline": "...", "description": "...", "cta_button": "...", "hook": "..." }], "audience_targeting": { "interests": [...], "behaviors": [...], "demographics": "..." }, "budget_suggestion": "..." }`,

  meta_tags: (w, o) => `Generate complete SEO meta tags for a page on ${w.name} (${w.url}).

PAGE TYPE: ${o.page_type || 'Homepage'}
TOPIC: ${o.topic}
TARGET KEYWORD: ${o.keyword}

Provide ALL meta tags needed. JSON: {
  "title": "...",
  "meta_description": "...",
  "og_title": "...",
  "og_description": "...",
  "og_image_alt": "...",
  "twitter_title": "...",
  "twitter_description": "...",
  "schema_markup": { "@context": "...", "@type": "...", ... },
  "canonical_url": "...",
  "robots": "..."
}`,

  content_calendar: (w, o) => `Create a comprehensive 30-day content marketing calendar for ${w.name}.

BUSINESS: ${w.industry} | AUDIENCE: ${w.target_audience}
MONTH: ${o.month || new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
CHANNELS: Blog, Instagram, Facebook, LinkedIn, Email, Google Ads

JSON: {
  "month": "...",
  "strategy_summary": "...",
  "weekly_themes": [{ "week": 1, "theme": "...", "rationale": "..." }],
  "calendar": [
    {
      "date": "2024-XX-XX",
      "channel": "blog|instagram|facebook|linkedin|email|google_ads",
      "content_type": "...",
      "topic": "...",
      "target_keyword": "...",
      "notes": "..."
    }
  ],
  "kpis": ["..."]
}`,
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const website_id = searchParams.get('website_id')

  const admin = createAdminClient()
  let query = admin.from('generated_content').select('*').order('created_at', { ascending: false })
  if (website_id) query = query.eq('website_id', website_id)

  const { data } = await query
  return NextResponse.json({ content: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { website_id, type, options = {} } = body

  const admin = createAdminClient()
  const { data: website } = await admin.from('websites').select('*').eq('id', website_id).single()
  if (!website) return NextResponse.json({ error: 'Website not found' }, { status: 404 })

  const promptFn = CONTENT_PROMPTS[type]
  if (!promptFn) return NextResponse.json({ error: 'Unknown content type' }, { status: 400 })

  const prompt = promptFn(website, options)

  const completion = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert digital marketing strategist and SEO copywriter for ${website.industry} businesses.
Your content is always accurate, compelling, and optimized for search engines and conversions.
Always respond with valid JSON only.`,
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 4000,
  })

  const generatedData = JSON.parse(completion.choices[0].message.content ?? '{}')

  // Derive title
  const title = generatedData.title
    || generatedData.meta_title
    || (options.topic ? `${type.replace(/_/g, ' ')}: ${options.topic}` : type.replace(/_/g, ' '))

  const { data: saved } = await admin.from('generated_content').insert({
    website_id,
    created_by: user.id,
    type,
    title,
    content: JSON.stringify(generatedData),
    metadata: { options, keyword: options.keyword },
    status: 'draft',
  }).select().single()

  return NextResponse.json({ content: { ...saved, parsed: generatedData } })
}
