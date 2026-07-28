import { NextRequest, NextResponse } from 'next/server'
import { scoreFollowUpPriority } from '@/lib/anthropic/client'

export async function POST(req: NextRequest) {
  try {
    const { leads } = await req.json()
    const result = await scoreFollowUpPriority(leads)
    return NextResponse.json(result)
  } catch (err) {
    console.error('AI priority score error:', err)
    return NextResponse.json({ error: 'AI failed' }, { status: 500 })
  }
}
