import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { draft, platform } = await req.json()
    const supabase = createAdminClient()

    // Mark the latest pending draft as approved
    await supabase
      .from('ai_ad_drafts')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('platform', platform)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)

    return NextResponse.json({ success: true, message: 'Ad approved — copy it to your Meta/Google Ads Manager to publish' })
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
