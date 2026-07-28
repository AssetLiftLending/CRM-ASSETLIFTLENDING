import { NextRequest, NextResponse } from 'next/server'
import { generateAdCopy } from '@/lib/openai/client'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await generateAdCopy(body)

    // Save as pending draft in DB
    const supabase = createAdminClient()
    await supabase.from('ai_ad_drafts').insert({
      platform:        body.platform,
      campaign_goal:   body.goal,
      target_audience: body.targetAudience,
      loan_program:    body.loanProgram,
      variations:      result.variations ?? [result],
      status:          'pending',
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('AI ad generation error:', err)
    return NextResponse.json({ error: 'AI failed' }, { status: 500 })
  }
}
