import { createServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import DealDetailClient from '@/components/deals/DealDetailClient'

export default async function DealDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()

  const [{ data: deal }, { data: docs }, { data: tasks }] = await Promise.all([
    supabase
      .from('deals')
      .select('*, contacts(*), profiles:assigned_to(full_name)')
      .eq('id', params.id)
      .single(),
    supabase.from('documents').select('*').eq('deal_id', params.id).order('created_at'),
    supabase.from('tasks').select('*, profiles(full_name)').eq('deal_id', params.id).order('due_date'),
  ])

  if (!deal) notFound()

  return <DealDetailClient deal={deal} docs={docs ?? []} tasks={tasks ?? []} />
}
