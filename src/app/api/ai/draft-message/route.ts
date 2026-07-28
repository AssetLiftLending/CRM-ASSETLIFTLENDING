import { NextRequest, NextResponse } from 'next/server'
import { draftFollowUpMessage } from '@/lib/openai/client'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await draftFollowUpMessage(body)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Draft message error:', err)
    return NextResponse.json({ error: 'AI failed' }, { status: 500 })
  }
}
