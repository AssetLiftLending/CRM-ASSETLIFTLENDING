import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const supabase = createAdminClient()
  const update: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() }
  if (body.status === 'completed') update.completed_at = new Date().toISOString()
  const { data, error } = await supabase.from('tasks').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
