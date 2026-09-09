import { createAdminClient, createClient } from '@/lib/supabase/server'

export interface StaffContext {
  userId: string
  email: string | null
  fullName: string | null
  phone: string | null
  role: string
  organizationId: string | null
}

/** Roles that may send outbound messages on behalf of the company. */
const SENDER_ROLES = ['platform_admin', 'organization_admin', 'owner', 'loan_officer', 'processor', 'marketing']

export function canSendCommunications(role?: string | null) {
  return Boolean(role && SENDER_ROLES.includes(role))
}

/** Resolves the signed-in staff member and their organization for API routes. */
export async function getStaffContext(): Promise<StaffContext | null> {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return null

  const { data: profile } = await createAdminClient()
    .from('profiles')
    .select('id, email, full_name, phone, role, organization_id')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  return {
    userId: profile.id,
    email: profile.email ?? user.email ?? null,
    fullName: profile.full_name ?? null,
    phone: profile.phone ?? null,
    role: profile.role ?? 'read_only',
    organizationId: profile.organization_id ?? null,
  }
}
