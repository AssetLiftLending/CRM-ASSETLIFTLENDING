import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getOpenAIClient } from '@/lib/openai/client'

async function crawlWebsite(url: string): Promise<{ html: string; text: string; meta: Record<string, string> }> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AssetLiftBot/1.0; SEO Audit)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    })
    const html = await res.text()

    // Extract key elements
    const getTag = (tag: string) => {
      const m = html.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'i'))
      return m?.[1]?.trim() ?? ''
    }
    const getMeta = (name: string) => {
      const m = html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`, 'i'))
      return m?.[1]?.trim() ?? ''
    }
    const getOg = (prop: string) => {
      const m = html.match(new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']+)["']`, 'i'))
      return m?.[1]?.trim() ?? ''
    }

    const h1s = [...html.matchAll(/<h1[^>]*>([^<]+)<\/h1>/gi)].map(m => m[1].trim()).slice(0, 5)
    const h2s = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi)].map(m => m[1].trim()).slice(0, 10)

    // Strip HTML for text sample
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000)

    const meta = {
      title: getTag('title'),
      description: getMeta('description'),
      keywords_meta: getMeta('keywords'),
      og_title: getOg('title'),
      og_description: getOg('description'),
      h1s: h1s.join(' | '),
      h2s: h2s.join(' | '),
      has_schema: html.includes('application/ld+json') ? 'yes' : 'no',
      has_canonical: html.includes('rel="canonical"') ? 'yes' : 'no',
      has_robots: html.includes('robots') ? 'yes' : 'no',
      links_count: (html.match(/<a\s/gi) || []).length.toString(),
      images_count: (html.match(/<img\s/gi) || []).length.toString(),
      images_no_alt: (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length.toString(),
      word_count: stripped.split(/\s+/).length.toString(),
    }

    return { html: html.slice(0, 8000), text: stripped, meta }
  } catch (err: any) {
    throw new Error(`Failed to crawl ${url}: ${err.message}`)
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { website_id } = await req.json()
  const admin = createAdminClient()

  // Get website
  const { data: website } = await admin.from('websites').select('*').eq('id', website_id).single()
  if (!website) return NextResponse.json({ error: 'Website not found' }, { status: 404 })

  // Create pending audit record
  const { data: auditRecord } = await admin.from('seo_audits').insert({
    website_id,
    score: null,
    audit_data: {},
    status: 'pending',
  }).select().single()

  try {
    // Crawl the website
    const { text, meta } = await crawlWebsite(website.url)

    // AI audit
    const prompt = `You are an expert SEO analyst. Perform a comprehensive SEO audit for the following website.

WEBSITE INFO:
- Name: ${website.name}
- URL: ${website.url}
- Industry: ${website.industry || 'Not specified'}
- Location: ${website.location || 'Not specified'}
- Target Audience: ${website.target_audience || 'Not specified'}
- Primary Keywords: ${(website.primary_keywords || []).join(', ')}
- Known Competitors: ${(website.competitors || []).join(', ')}

CRAWLED DATA:
- Page Title: ${meta.title}
- Meta Description: ${meta.description}
- H1 Tags: ${meta.h1s}
- H2 Tags: ${meta.h2s}
- Schema Markup: ${meta.has_schema}
- Canonical Tag: ${meta.has_canonical}
- Word Count: ${meta.word_count}
- Total Links: ${meta.links_count}
- Images: ${meta.images_count} (${meta.images_no_alt} without alt text)
- OG Title: ${meta.og_title}
- OG Description: ${meta.og_description}

PAGE CONTENT SAMPLE:
${text.slice(0, 2000)}

Provide a thorough SEO audit in the following JSON format:
{
  "score": <0-100 overall SEO score>,
  "summary": "<2-3 sentence executive summary>",
  "critical_issues": [
    {"issue": "<issue title>", "description": "<what's wrong>", "fix": "<how to fix it>", "impact": "high|medium|low"}
  ],
  "on_page_seo": {
    "score": <0-100>,
    "title_tag": {"status": "good|warning|critical", "current": "<current title>", "recommendation": "<suggested title>"},
    "meta_description": {"status": "good|warning|critical", "current": "<current>", "recommendation": "<suggested>"},
    "h1": {"status": "good|warning|critical", "notes": "<notes>"},
    "headings_structure": {"status": "good|warning|critical", "notes": "<notes>"},
    "content_quality": {"status": "good|warning|critical", "word_count": <number>, "notes": "<notes>"},
    "images": {"status": "good|warning|critical", "total": <n>, "missing_alt": <n>, "notes": "<notes>"},
    "schema_markup": {"status": "good|warning|critical", "has_schema": <bool>, "recommended_types": ["<type1>", "<type2>"]},
    "canonical": {"status": "good|warning|critical", "notes": "<notes>"}
  },
  "technical_seo": {
    "score": <0-100>,
    "items": [
      {"name": "<check name>", "status": "pass|warn|fail", "notes": "<notes>"}
    ]
  },
  "keyword_opportunities": [
    {"keyword": "<keyword>", "intent": "informational|commercial|transactional|navigational", "difficulty": "<easy|medium|hard>", "volume_estimate": "<range>", "relevance": "high|medium"}
  ],
  "content_gaps": [
    "<topic or content gap that should be addressed>"
  ],
  "quick_wins": [
    "<actionable quick win that can be implemented immediately>"
  ],
  "local_seo": {
    "applicable": <true|false>,
    "score": <0-100>,
    "items": [{"name": "<check>", "status": "pass|warn|fail", "notes": "<notes>"}]
  },
  "recommendations_priority": [
    {"priority": 1, "action": "<action>", "expected_impact": "<impact>", "effort": "low|medium|high"}
  ]
}`

    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const auditData = JSON.parse(completion.choices[0].message.content ?? '{}')

    // Save results
    await admin.from('seo_audits').update({
      score: auditData.score ?? 0,
      audit_data: auditData,
      raw_html: text.slice(0, 5000),
      status: 'completed',
    }).eq('id', auditRecord!.id)

    // Save keyword opportunities to tracked_keywords
    if (auditData.keyword_opportunities?.length) {
      const kws = auditData.keyword_opportunities.map((k: any) => ({
        website_id,
        keyword: k.keyword,
        intent: k.intent,
        difficulty: k.difficulty === 'easy' ? 25 : k.difficulty === 'medium' ? 55 : 80,
        volume_est: k.volume_estimate,
      }))
      await admin.from('tracked_keywords').upsert(kws, { onConflict: 'website_id,keyword' })
    }

    return NextResponse.json({ audit: { ...auditData, id: auditRecord!.id } })
  } catch (err: any) {
    await admin.from('seo_audits').update({ status: 'failed', audit_data: { error: err.message } }).eq('id', auditRecord!.id)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
