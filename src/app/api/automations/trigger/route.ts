import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { triggerAutomations } from '@/lib/automations/engine'

export async function POST(req: NextRequest) {
  try {
    const result = await triggerAutomations(createAdminClient(), await req.json())
    return NextResponse.json(result)
  } catch (err) {
    console.error('Automation trigger error:', err)
    return NextResponse.json({ error: 'Automation trigger failed' }, { status: 500 })
  }
}
