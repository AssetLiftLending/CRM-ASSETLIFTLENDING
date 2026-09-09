import { createServerClient } from '@/lib/supabase/server'
import ContactsClient from '@/components/contacts/ContactsClient'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; source?: string; new?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const supabase = await createServerClient()

  let query = supabase
    .from('contacts')
    .select(`
      id, first_name, last_name, email, phone, lead_source, created_at, tags, is_archived, assigned_to,
      deals(id, stage, loan_program, loan_amount, title, updated_at)
    `)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(100)

  if (resolvedSearchParams.q) {
    query = query.or(`first_name.ilike.%${resolvedSearchParams.q}%,last_name.ilike.%${resolvedSearchParams.q}%,email.ilike.%${resolvedSearchParams.q}%,phone.ilike.%${resolvedSearchParams.q}%`)
  }
  if (resolvedSearchParams.source) {
    query = query.eq('lead_source', resolvedSearchParams.source)
  }

  const { data: contacts } = await query
  const { data: profiles } = await supabase.from('profiles').select('id,full_name').eq('is_active', true)

  return (
    <ContactsClient
      contacts={contacts ?? []}
      profiles={profiles ?? []}
      defaultNew={!!resolvedSearchParams.new}
    />
  )
}
