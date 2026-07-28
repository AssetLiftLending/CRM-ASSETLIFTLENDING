'use client'

import { useState } from 'react'
import { Plus, CheckCircle2, Circle, Clock, AlertTriangle, Flag } from 'lucide-react'
import { fmt, PRIORITY_COLORS } from '@/lib/utils/format'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface Task {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  due_date?: string
  completed_at?: string
  tags?: string[]
  contacts?: { id: string; first_name: string; last_name: string } | null
  deals?: { id: string; title?: string; loan_program: string } | null
  profiles?: { id: string; full_name: string } | null
}

type Filter = 'all' | 'today' | 'overdue' | 'mine' | 'completed'

export default function TasksClient({
  tasks: initialTasks,
  profiles,
  currentUserId,
}: {
  tasks: Task[]
  profiles: Array<{ id: string; full_name: string | null }>
  currentUserId: string
}) {
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const [filter, setFilter] = useState<Filter>('all')
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [newDue, setNewDue] = useState('')
  const [newAssigned, setNewAssigned] = useState(currentUserId)

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const filtered = tasks.filter((t) => {
    if (filter === 'today') {
      return t.due_date?.startsWith(todayStr) && t.status !== 'completed'
    }
    if (filter === 'overdue') {
      return t.due_date && new Date(t.due_date) < now && t.status !== 'completed'
    }
    if (filter === 'mine') {
      return t.profiles?.id === currentUserId && t.status !== 'completed'
    }
    if (filter === 'completed') return t.status === 'completed'
    return t.status !== 'completed'
  })

  const overdueCnt = tasks.filter((t) => t.due_date && new Date(t.due_date) < now && t.status !== 'completed').length
  const todayCnt   = tasks.filter((t) => t.due_date?.startsWith(todayStr) && t.status !== 'completed').length

  async function toggleComplete(task: Task) {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t))
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        priority: newPriority,
        due_date: newDue || null,
        assigned_to: newAssigned || null,
      }),
    })
    if (res.ok) {
      toast.success('Task created')
      setShowNew(false)
      setNewTitle('')
      router.refresh()
    }
  }

  const FILTERS: { key: Filter; label: string; cnt?: number }[] = [
    { key: 'all',       label: 'All Open' },
    { key: 'today',     label: 'Today',    cnt: todayCnt },
    { key: 'overdue',   label: 'Overdue',  cnt: overdueCnt },
    { key: 'mine',      label: 'Mine' },
    { key: 'completed', label: 'Completed' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-800">Tasks</h1>
          <p className="text-gray-500 text-sm">{tasks.filter(t => t.status !== 'completed').length} open tasks</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-800 font-semibold text-sm px-4 py-2.5 rounded-xl transition-base"
        >
          <Plus size={16} /> New Task
        </button>
      </div>

      {/* Quick Create */}
      {showNew && (
        <form onSubmit={createTask} className="bg-white border border-gold-300 rounded-2xl p-5 shadow-sm space-y-3">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Task title…"
            className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-gold-500"
          />
          <div className="flex gap-3">
            <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
            <select value={newAssigned} onChange={(e) => setNewAssigned(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none">
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
            <button type="submit" className="bg-gold-500 text-dark-800 font-bold px-4 py-2 rounded-xl text-sm">Save</button>
            <button type="button" onClick={() => setShowNew(false)}
              className="border border-gray-200 text-gray-500 px-4 py-2 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1.5 shadow-sm w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-base
              ${filter === f.key ? 'bg-gold-500 text-dark-800' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
          >
            {f.label}
            {f.cnt != null && f.cnt > 0 && (
              <span className={`text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold
                ${filter === f.key ? 'bg-dark-800 text-gold-400' : f.key === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                {f.cnt}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filtered.map((task) => {
          const isOverdue = task.due_date && new Date(task.due_date) < now && task.status !== 'completed'
          return (
            <div
              key={task.id}
              className={`bg-white border rounded-2xl p-4 flex items-start gap-4 shadow-sm transition-base hover:shadow-md
                ${isOverdue ? 'border-red-200 bg-red-50/30' : 'border-gray-100'}`}
            >
              {/* Complete toggle */}
              <button onClick={() => toggleComplete(task)} className="mt-0.5 flex-shrink-0 transition-base">
                {task.status === 'completed'
                  ? <CheckCircle2 size={20} className="text-green-500" />
                  : <Circle size={20} className="text-gray-300 hover:text-gold-500" />
                }
              </button>

              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-dark-800'}`}>
                  {task.title}
                </div>
                {task.description && (
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{task.description}</div>
                )}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {task.contacts && (
                    <span className="text-xs text-gray-500">
                      👤 {fmt.name(task.contacts.first_name, task.contacts.last_name)}
                    </span>
                  )}
                  {task.profiles && (
                    <span className="text-xs text-gray-500">
                      → {task.profiles.full_name}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority]}`}>
                  {task.priority}
                </span>
                {task.due_date && (
                  <span className={`flex items-center gap-1 text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                    {isOverdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
                    {fmt.date(task.due_date)}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <div className="text-3xl mb-3">✅</div>
            <div className="font-medium text-gray-700">
              {filter === 'overdue' ? 'No overdue tasks!' : filter === 'today' ? 'Nothing due today' : 'No tasks here'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
