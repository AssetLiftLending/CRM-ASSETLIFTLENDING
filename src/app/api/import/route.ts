import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/auth/session'
import { pick, resolveName } from '@/lib/import/csv'
import { toE164 } from '@/lib/twilio/phone'

export const dynamic = 'force-dynamic'

// Contact CSV import — GoHighLevel exports and anything shaped like them.
export async function POST(req: NextRequest) {
  const staff = await getStaffContext()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let contacts: Record<string, string>[]
  try {
    const body = await req.json()
    contacts = body?.contacts
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return NextResponse.json({ error: 'No contacts provided' }, { status: 400 })
  }

  const supabase = createAdminClient()
  let imported = 0, updated = 0, skipped = 0, errors = 0
  const problems: string[] = []

  for (const [index, row] of contacts.entries()) {
    try {
      const { first, last } = resolveName(row)
      const email = pick(row, 'Email', 'Email Address', 'Primary Email', 'e-mail').toLowerCase()
      const rawPhone = pick(row, 'Phone', 'Phone Number', 'Mobile Phone', 'Mobile', 'Cell', 'Cell Phone', 'Primary Phone')
      const phone = toE164(rawPhone) ?? rawPhone
      const source = pick(row, 'Lead Source', 'Source', 'Channel') || 'ghl_import'
      const notes = pick(row, 'Notes', 'Note', 'Description', 'Comments')
      const tagValue = pick(row, 'Tags', 'Tag')
      const tags = tagValue ? tagValue.split(',').map((t) => t.trim()).filter(Boolean) : []

      // A row with no name, email or phone carries nothing worth keeping.
      if (!first && !last && !email && !phone) { skipped++; continue }

      // Match an existing contact on email first, then phone.
      let existing: { id: string; first_name: string | null; last_name: string | null } | null = null
      if (email) {
        const { data } = await supabase
          .from('contacts')
          .select('id, first_name, last_name')
          .ilike('email', email)
          .limit(1)
          .maybeSingle()
        existing = data ?? null
      }
      if (!existing && phone) {
        const { data } = await supabase
          .from('contacts')
          .select('id, first_name, last_name')
          .eq('phone', phone)
          .limit(1)
          .maybeSingle()
        existing = data ?? null
      }

      if (existing) {
        // Re-importing the same file repairs names that came in blank or as
        // "Unknown" the first time, rather than skipping the row outright.
        const storedFirst = (existing.first_name ?? '').trim()
        const namelessBefore = !storedFirst || storedFirst.toLowerCase() === 'unknown'
        if (namelessBefore && (first || last)) {
          const { error } = await supabase
            .from('contacts')
            .update({ first_name: first || storedFirst || '', last_name: last || existing.last_name || '' })
            .eq('id', existing.id)
          if (error) throw error
          updated++
        } else {
          skipped++
        }
        continue
      }

      const { data: contact, error: insertError } = await supabase.from('contacts').insert({
        first_name:  first,
        last_name:   last,
        email:       email || null,
        phone:       phone || null,
        lead_source: source.toLowerCase().replace(/\s+/g, '_'),
        tags,
        organization_id: staff.organizationId ?? null,
      }).select('id').single()

      if (insertError) throw insertError

      if (contact && notes) {
        await supabase.from('communications').insert({
          contact_id: contact.id,
          organization_id: staff.organizationId ?? null,
          type: 'note',
          body: `[Imported] ${notes}`,
          snippet: notes.slice(0, 200),
        })
      }

      if (contact) {
        await supabase.from('deals').insert({
          contact_id: contact.id,
          organization_id: staff.organizationId ?? null,
          stage: mapGHLStage(pick(row, 'Pipeline Stage', 'Stage', 'Status')),
          loan_program: 'fix_flip',
          lead_source: source.toLowerCase().replace(/\s+/g, '_'),
        })
      }

      imported++
    } catch (err) {
      errors++
      // Name the row so a failed import can actually be diagnosed.
      if (problems.length < 5) {
        problems.push(`Row ${index + 2}: ${err instanceof Error ? err.message : 'failed'}`)
      }
    }
  }

  return NextResponse.json({ imported, updated, skipped, errors, problems, total: contacts.length })
}

function mapGHLStage(ghlStage: string): string {
  const s = (ghlStage || '').toLowerCase()
  if (!s) return 'new_lead'
  if (s.includes('new') || s.includes('inquiry')) return 'new_lead'
  if (s.includes('contact') || s.includes('pending') || s.includes('search') || s.includes('nurture')) return 'pending_lead'
  if (s.includes('dead') || s.includes('lost') || s.includes('unqualified')) return 'dead_lead'
  if (s.includes('progress') || s.includes('active') || s.includes('processing')) return 'in_progress'
  if (s.includes('fund') || s.includes('closed') || s.includes('won')) return 'closed_deal'
  return 'new_lead'
}
