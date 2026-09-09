import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { toRequirementKey } from '@/lib/documents/checklist'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['platform_admin', 'organization_admin', 'owner', 'loan_officer', 'processor', 'marketing']

async function requireStaff() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single()

  if (!profile || !STAFF_ROLES.includes(profile.role)) return null
  return profile
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await createAdminClient()
    .from('deal_document_requirements')
    .select('id, key, label, sort_order')
    .eq('deal_id', id)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requirements: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let label = ''
  try {
    const body = await req.json()
    label = String(body?.label ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!label) return NextResponse.json({ error: 'Give the document a name.' }, { status: 400 })
  if (label.length > 80) return NextResponse.json({ error: 'Keep the name under 80 characters.' }, { status: 400 })

  const key = toRequirementKey(label)
  if (!key) return NextResponse.json({ error: 'Use letters or numbers in the name.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: deal } = await admin.from('deals').select('id, organization_id').eq('id', id).single()
  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  // Append after whatever is already requested.
  const { data: last } = await admin
    .from('deal_document_requirements')
    .select('sort_order')
    .eq('deal_id', id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await admin
    .from('deal_document_requirements')
    .upsert({
      deal_id:         id,
      organization_id: deal.organization_id ?? staff.organization_id ?? null,
      key,
      label,
      sort_order:      (last?.sort_order ?? 0) + 1,
      created_by:      staff.id,
    }, { onConflict: 'deal_id,key' })
    .select('id, key, label, sort_order')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ requirement: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = new URL(req.url).searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'Which document?' }, { status: 400 })

  const admin = createAdminClient()
  // Only the request is removed; anything already uploaded against it is kept.
  const { error } = await admin
    .from('deal_document_requirements')
    .delete()
    .eq('deal_id', id)
    .eq('key', key)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
