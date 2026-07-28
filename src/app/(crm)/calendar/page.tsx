import { createServerClient } from '@/lib/supabase/server'
import CalendarClient from '@/components/calendar/CalendarClient'

export default async function CalendarPage() {
  const supabase = createServerClient()

  const [{ data: appointments }, { data: tasks }] = await Promise.all([
    supabase
      .from('appointments')
      .select('*, contacts(first_name, last_name)')
      .gte('start_time', new Date(Date.now() - 30 * 86400000).toISOString())
      .order('start_time'),
    supabase
      .from('tasks')
      .select('*, contacts(first_name, last_name)')
      .not('due_date', 'is', null)
      .neq('status', 'completed')
      .order('due_date'),
  ])

  return <CalendarClient appointments={appointments ?? []} tasks={tasks ?? []} />
}
