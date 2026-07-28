import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

const PLATFORM_ROLES = ['platform_admin']
const ORG_ADMIN_ROLES = ['platform_admin', 'organization_admin', 'owner']
const ORG_USER_ROLES = ['loan_officer', 'processor', 'marketing', 'read_only', 'broker', 'borrower']

export async function GET() {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: creator } = await admin
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single()

  if (!creator || !ORG_ADMIN_ROLES.includes(creator.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let query = admin
    .from('profiles')
    .select('id, full_name, email, phone, role, is_active, approved, created_at, organization_id')
    .order('created_at', { ascending: false })

  if (creator.role !== 'platform_admin') {
    query = query.eq('organization_id', creator.organization_id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ users: data ?? [] })
}

export async function POST(req: NextRequest) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: creator } = await admin
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single()

  if (!creator || !ORG_ADMIN_ROLES.includes(creator.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const fullName = String(body.full_name ?? '').trim()
  const role = String(body.role ?? 'loan_officer')
  const phone = body.phone ? String(body.phone).trim() : null

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: 'Email, password, and full name are required.' }, { status: 400 })
  }

  const canCreatePlatformRole = PLATFORM_ROLES.includes(creator.role)
  const allowedRoles = canCreatePlatformRole
    ? ['platform_admin', 'organization_admin', 'owner', ...ORG_USER_ROLES]
    : ['organization_admin', 'owner', ...ORG_USER_ROLES]

  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: 'You cannot create that role.' }, { status: 403 })
  }

  const organizationId = canCreatePlatformRole && body.organization_id
    ? String(body.organization_id)
    : creator.organization_id

  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organization.' }, { status: 400 })
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
      organization_id: organizationId,
    },
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const userId = authData.user.id

  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId,
    email,
    full_name: fullName,
    phone,
    role,
    is_active: true,
    approved: role !== 'broker',
    approved_at: role === 'broker' ? null : new Date().toISOString(),
    organization_id: organizationId,
    current_organization_id: organizationId,
  })

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  await admin.from('organization_memberships').upsert({
    organization_id: organizationId,
    user_id: userId,
    role,
    is_active: true,
  }, { onConflict: 'organization_id,user_id' })

  let contactId: string | null = null
  if (role === 'borrower') {
    const [firstName, ...rest] = fullName.split(' ')
    const lastName = rest.join(' ') || 'Borrower'

    const { data: existingContact } = await admin
      .from('contacts')
      .select('id')
      .eq('email', email)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (existingContact) {
      const { error: contactError } = await admin
        .from('contacts')
        .update({ portal_user_id: userId, organization_id: organizationId })
        .eq('id', existingContact.id)

      if (contactError) return NextResponse.json({ error: contactError.message }, { status: 500 })
      contactId = existingContact.id
    } else {
      const { data: contact, error: contactError } = await admin
        .from('contacts')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          lead_source: 'admin_created',
          portal_user_id: userId,
          organization_id: organizationId,
          stage: 'new_lead',
        })
        .select('id')
        .single()

      if (contactError) return NextResponse.json({ error: contactError.message }, { status: 500 })
      contactId = contact.id
    }
  }

  return NextResponse.json({
    user: {
      id: userId,
      email,
      full_name: fullName,
      role,
      organization_id: organizationId,
      contact_id: contactId,
    },
  })
}
