import type { StaffContext } from '@/lib/auth/session'

export interface MergeContact {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  cell_phone?: string | null
  city?: string | null
  state?: string | null
  entity_name?: string | null
}

/**
 * Variables available to {{merge_tags}} in email and SMS templates.
 * Keys are intentionally snake_case to match the seeded templates.
 */
export function buildMergeVars(contact?: MergeContact | null, sender?: StaffContext | null) {
  const firstName = contact?.first_name?.trim() ?? ''
  const lastName  = contact?.last_name?.trim() ?? ''

  return {
    first_name:   firstName,
    last_name:    lastName,
    full_name:    [firstName, lastName].filter(Boolean).join(' '),
    name:         [firstName, lastName].filter(Boolean).join(' '),
    email:        contact?.email ?? '',
    phone:        contact?.phone ?? contact?.cell_phone ?? '',
    city:         contact?.city ?? '',
    state:        contact?.state ?? '',
    entity_name:  contact?.entity_name ?? '',
    agent_name:   sender?.fullName ?? 'Asset Lift Lending',
    agent_email:  sender?.email ?? process.env.SENDGRID_FROM_EMAIL ?? '',
    agent_phone:  sender?.phone ?? process.env.TWILIO_PHONE_NUMBER ?? '',
    company_name: process.env.SENDGRID_FROM_NAME ?? 'Asset Lift Lending',
    company_phone: process.env.TWILIO_PHONE_NUMBER ?? '',
  } as Record<string, string>
}
