import { createServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import DealDetailClient from '@/components/deals/DealDetailClient'

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const [{ data: deal }, { data: docs }, { data: tasks }] = await Promise.all([
    supabase
      .from('deals')
      .select('*, contacts(*), profiles:assigned_to(full_name)')
      .eq('id', id)
      .single(),
    supabase.from('documents').select('*').eq('deal_id', id).order('created_at'),
    supabase.from('tasks').select('*, profiles(full_name)').eq('deal_id', id).order('due_date'),
  ])

  const { data: documentRequirements } = await supabase
    .from('deal_document_requirements')
    .select('id, key, label, sort_order')
    .eq('deal_id', id)
    .order('sort_order')

  if (!deal) notFound()

  return (
    <DealDetailClient
      deal={deal}
      docs={docs ?? []}
      tasks={tasks ?? []}
      documentRequirements={documentRequirements ?? []}
    />
  )
}
