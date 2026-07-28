import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const admin = createAdminClient()

  const updateData: Record<string, any> = {}
  if (body.status) updateData.status = body.status
  if (body.content) updateData.content = body.content
  if (body.title) updateData.title = body.title
  if (body.scheduled_for) updateData.scheduled_for = body.scheduled_for
  if (body.status === 'published') updateData.published_at = new Date().toISOString()

  const { data, error } = await admin.from('generated_content').update(updateData).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ content: data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  await admin.from('generated_content').update({ status: 'archived' }).eq('id', params.id)
  return NextResponse.json({ success: true })
}
