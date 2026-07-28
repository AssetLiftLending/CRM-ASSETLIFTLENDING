import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const COLORS = [
  'border-blue-300 bg-blue-50',
  'border-yellow-300 bg-yellow-50',
  'border-red-300 bg-red-50',
  'border-gold-300 bg-gold-50',
  'border-green-300 bg-green-50',
  'border-purple-300 bg-purple-50',
  'border-gray-300 bg-gray-50',
]

function slugify(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || `stage_${Date.now()}`
}

async function getContext() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, role, organization_id, current_organization_id')
    .eq('id', user.id)
    .single()

  if (error || !profile) return { error: NextResponse.json({ error: 'Profile not found' }, { status: 403 }) }

  const organizationId = profile.current_organization_id || profile.organization_id
  const canManage = ['platform_admin', 'organization_admin', 'owner', 'loan_officer', 'processor'].includes(profile.role)
  if (!organizationId || !canManage) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  return { admin, organizationId }
}

export async function GET() {
  const context = await getContext()
  if ('error' in context) return context.error

  const { data, error } = await context.admin
    .from('pipeline_stages')
    .select('*')
    .eq('organization_id', context.organizationId)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stages: data ?? [] })
}

export async function POST(req: NextRequest) {
  const context = await getContext()
  if ('error' in context) return context.error

  const body = await req.json()
  const label = String(body.label || '').trim()
  if (!label) return NextResponse.json({ error: 'Stage name is required' }, { status: 400 })

  const { count } = await context.admin
    .from('pipeline_stages')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', context.organizationId)

  const key = slugify(body.key || label)
  const { data, error } = await context.admin
    .from('pipeline_stages')
    .insert({
      organization_id: context.organizationId,
      key,
      label,
      sort_order: body.sort_order ?? ((count ?? 0) + 1),
      color: body.color || COLORS[(count ?? 0) % COLORS.length],
      is_closed: Boolean(body.is_closed),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stage: data })
}

export async function PATCH(req: NextRequest) {
  const context = await getContext()
  if ('error' in context) return context.error

  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'Stage id is required' }, { status: 400 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.label !== undefined) update.label = String(body.label).trim()
  if (body.sort_order !== undefined) update.sort_order = Number(body.sort_order)
  if (body.color !== undefined) update.color = String(body.color)
  if (body.is_closed !== undefined) update.is_closed = Boolean(body.is_closed)

  const { data, error } = await context.admin
    .from('pipeline_stages')
    .update(update)
    .eq('id', body.id)
    .eq('organization_id', context.organizationId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stage: data })
}

export async function DELETE(req: NextRequest) {
  const context = await getContext()
  if ('error' in context) return context.error

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const fallbackKey = searchParams.get('fallback') || 'new_lead'
  if (!id) return NextResponse.json({ error: 'Stage id is required' }, { status: 400 })

  const { data: stage, error: stageError } = await context.admin
    .from('pipeline_stages')
    .select('key')
    .eq('id', id)
    .eq('organization_id', context.organizationId)
    .single()

  if (stageError || !stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })

  await context.admin
    .from('deals')
    .update({ stage: fallbackKey, updated_at: new Date().toISOString() })
    .eq('organization_id', context.organizationId)
    .eq('stage', stage.key)

  const { error } = await context.admin
    .from('pipeline_stages')
    .delete()
    .eq('id', id)
    .eq('organization_id', context.organizationId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
