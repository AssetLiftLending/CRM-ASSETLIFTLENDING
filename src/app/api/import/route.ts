import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GHL CSV Import — accepts exported contacts CSV
export async function POST(req: NextRequest) {
  try {
    const { contacts } = await req.json()
    // contacts: array of rows from GHL export or manual paste

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts provided' }, { status: 400 })
    }

    const supabase = createAdminClient()
    let imported = 0, skipped = 0, errors = 0

    for (const row of contacts) {
      try {
        // Normalize GHL field names → CRM fields
        const firstName = row['First Name'] ?? row['first_name'] ?? row.firstName ?? ''
        const lastName  = row['Last Name']  ?? row['last_name']  ?? row.lastName  ?? ''
        const email     = row['Email']      ?? row['email']       ?? ''
        const phone     = row['Phone']      ?? row['phone']       ?? row['Mobile Phone'] ?? ''
        const tags      = row['Tags']       ? String(row['Tags']).split(',').map((t: string) => t.trim()) : []
        const source    = row['Lead Source'] ?? row['source'] ?? 'ghl_import'
        const notes     = row['Notes'] ?? row['notes'] ?? ''

        if (!firstName && !email && !phone) { skipped++; continue }

        // Check for duplicate
        const { data: existing } = email
          ? await supabase.from('contacts').select('id').eq('email', email).single()
          : { data: null }

        if (existing) { skipped++; continue }

        const { data: contact } = await supabase.from('contacts').insert({
          first_name:  firstName || 'Unknown',
          last_name:   lastName  || '',
          email:       email || null,
          phone:       phone || null,
          lead_source: source.toLowerCase().replace(/\s+/g, '_'),
          tags,
        }).select('id').single()

        if (contact && notes) {
          await supabase.from('communications').insert({
            contact_id: contact.id,
            type: 'note',
            body: `[Imported from GHL] ${notes}`,
          })
        }

        // Create a deal in the new lead stage
        if (contact) {
          await supabase.from('deals').insert({
            contact_id: contact.id,
            stage: row['Pipeline Stage'] ? mapGHLStage(row['Pipeline Stage']) : 'new_lead',
            loan_program: 'fix_flip',
            lead_source: source.toLowerCase().replace(/\s+/g, '_'),
          })
        }

        imported++
      } catch {
        errors++
      }
    }

    return NextResponse.json({ imported, skipped, errors, total: contacts.length })
  } catch (err) {
    console.error('Import error:', err)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}

function mapGHLStage(ghlStage: string): string {
  const s = ghlStage.toLowerCase()
  if (s.includes('new') || s.includes('inquiry')) return 'new_lead'
  if (s.includes('contact') || s.includes('pending') || s.includes('search') || s.includes('nurture')) return 'pending_lead'
  if (s.includes('dead') || s.includes('lost') || s.includes('unqualified')) return 'dead_lead'
  if (s.includes('progress') || s.includes('active') || s.includes('processing')) return 'in_progress'
  if (s.includes('fund') || s.includes('closed') || s.includes('won')) return 'closed_deal'
  return 'new_lead'
}
