import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = ['platform_admin', 'organization_admin', 'owner']

export async function GET(req: NextRequest) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get('contact_id')
  const dealId = searchParams.get('deal_id')

  let query = admin
    .from('documents')
    .select(`
      *,
      contacts(id, first_name, last_name, email, phone),
      deals(id, title, property_address, stage, loan_program)
    `)
    .order('created_at', { ascending: false })

  if (profile.role !== 'platform_admin') {
    query = query.eq('organization_id', profile.organization_id)
  }

  if (contactId) query = query.eq('contact_id', contactId)
  if (dealId) query = query.eq('deal_id', dealId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ documents: data ?? [] })
}
