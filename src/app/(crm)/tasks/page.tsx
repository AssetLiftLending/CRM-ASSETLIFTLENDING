import { createServerClient } from '@/lib/supabase/server'
import TasksClient from '@/components/tasks/TasksClient'

export default async function TasksPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      id, title, description, priority, status, due_date, completed_at, is_recurring, tags, created_at,
      contacts(id, first_name, last_name),
      deals(id, title, loan_program),
      profiles:assigned_to(id, full_name)
    `)
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(200)

  const { data: profiles } = await supabase.from('profiles').select('id,full_name').eq('is_active', true)

  const normalizedTasks = (tasks ?? []).map((task) => ({
    ...task,
    contacts: Array.isArray(task.contacts) ? task.contacts[0] ?? null : task.contacts,
    deals: Array.isArray(task.deals) ? task.deals[0] ?? null : task.deals,
    profiles: Array.isArray(task.profiles) ? task.profiles[0] ?? null : task.profiles,
  }))

  return <TasksClient tasks={normalizedTasks} profiles={profiles ?? []} currentUserId={session?.user.id ?? ''} />
}
