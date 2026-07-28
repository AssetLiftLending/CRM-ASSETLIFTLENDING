import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: websites } = await admin
    .from('websites')
    .select(`
      *,
      seo_audits (id, score, created_at),
      generated_content (id, type, status)
    `)
    .order('created_at', { ascending: false })

  return NextResponse.json({ websites: websites ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const admin = createAdminClient()

  const { data, error } = await admin.from('websites').insert({
    name: body.name,
    url: body.url,
    industry: body.industry || null,
    location: body.location || null,
    target_audience: body.target_audience || null,
    competitors: body.competitors || [],
    primary_keywords: body.primary_keywords || [],
    notes: body.notes || null,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ website: data })
}
