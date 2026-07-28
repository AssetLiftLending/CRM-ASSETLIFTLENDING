import { createServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ContactDetailClient from '@/components/contacts/ContactDetailClient'

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()

  const [{ data: contact }, { data: deals }, { data: comms }, { data: tasks }, { data: docs }] =
    await Promise.all([
      supabase
        .from('contacts')
        .select('*, profiles(full_name)')
        .eq('id', params.id)
        .single(),
      supabase
        .from('deals')
        .select('*, profiles(full_name)')
        .eq('contact_id', params.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('communications')
        .select('*')
        .eq('contact_id', params.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('tasks')
        .select('*, profiles(full_name)')
        .eq('contact_id', params.id)
        .order('due_date', { ascending: true }),
      supabase
        .from('documents')
        .select('*')
        .eq('contact_id', params.id)
        .order('created_at', { ascending: false }),
    ])

  if (!contact) notFound()

  return (
    <ContactDetailClient
      contact={contact}
      deals={deals ?? []}
      comms={comms ?? []}
      tasks={tasks ?? []}
      docs={docs ?? []}
    />
  )
}
