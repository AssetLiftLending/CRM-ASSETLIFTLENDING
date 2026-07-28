'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, Clock, Phone, Calendar as CalendarIcon, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { fmt } from '@/lib/utils/format'

type Appointment = Record<string, any>
type Task        = Record<string, any>

interface Props { appointments: Appointment[]; tasks: Task[] }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function CalendarClient({ appointments, tasks }: Props) {
  const router = useRouter()
  const today  = new Date()
  const [curr, setCurr]   = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', start_time: '', end_time: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const year  = curr.getFullYear()
  const month = curr.getMonth()

  // Build calendar grid
  const firstDay  = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function eventsOnDay(day: number) {
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const appts = appointments.filter(a => a.start_time?.startsWith(d))
    const ts    = tasks.filter(t => t.due_date?.startsWith(d))
    return { appts, ts }
  }

  async function createAppointment() {
    if (!form.title || !form.start_time) return
    setSaving(true)
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) { toast.success('Appointment created'); setShowForm(false); setForm({ title: '', start_time: '', end_time: '', notes: '' }); router.refresh() }
    else toast.error('Failed to create appointment')
  }

  async function syncGoogleCalendar() {
    const res = await fetch('/api/calendar/sync', { method: 'POST' })
    if (res.ok) { toast.success('Synced with Google Calendar'); router.refresh() }
    else toast.error('Google Calendar sync failed — check your credentials in Settings')
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-800">Calendar</h1>
          <p className="text-gray-500 text-sm">Appointments, tasks, and follow-ups</p>
        </div>
        <div className="flex gap-2">
          <button onClick={syncGoogleCalendar}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:border-gold-400 hover:text-gold-700 font-medium px-4 py-2 rounded-xl text-sm transition-base">
            <CalendarIcon size={14} /> Sync Google
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-800 font-bold px-4 py-2 rounded-xl text-sm transition-base">
            <Plus size={14} /> New Appointment
          </button>
        </div>
      </div>

      {/* New Appointment Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gold-200 shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-dark-800">New Appointment</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Title</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                placeholder="Call with John Smith" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Start</label>
              <input type="datetime-local" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">End</label>
              <input type="datetime-local" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500 resize-none"
                placeholder="Optional notes…" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createAppointment} disabled={saving}
              className="bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800 font-bold px-5 py-2.5 rounded-xl text-sm">
              {saving ? 'Saving…' : 'Create Appointment'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {/* Main Calendar */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <button onClick={() => setCurr(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <h2 className="font-bold text-dark-800">{MONTHS[month]} {year}</h2>
            <button onClick={() => setCurr(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAYS.map(d => (
              <div key={d} className="text-xs font-bold text-gray-400 text-center py-2">{d}</div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="min-h-[80px] border-r border-b border-gray-50" />
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
              const { appts, ts } = eventsOnDay(day)

              return (
                <div key={day} className={`min-h-[80px] border-r border-b border-gray-50 p-1.5 ${isToday ? 'bg-gold-50' : 'hover:bg-gray-50'} transition-colors`}>
                  <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                    ${isToday ? 'bg-gold-500 text-dark-800' : 'text-gray-600'}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {appts.slice(0, 2).map(a => (
                      <div key={a.id} className="text-xs bg-blue-100 text-blue-700 rounded px-1 truncate">
                        {a.title}
                      </div>
                    ))}
                    {ts.slice(0, 2).map(t => (
                      <div key={t.id} className="text-xs bg-gold-100 text-gold-800 rounded px-1 truncate">
                        ✓ {t.title}
                      </div>
                    ))}
                    {(appts.length + ts.length) > 4 && (
                      <div className="text-xs text-gray-400 px-1">+{appts.length + ts.length - 4} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar: Upcoming */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="font-bold text-dark-800 mb-3">Upcoming (30 days)</h3>
            <div className="space-y-2">
              {appointments.slice(0, 8).map(a => (
                <div key={a.id} className="flex items-start gap-2.5 text-sm">
                  <Clock size={13} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-dark-800 truncate">{a.title}</p>
                    {a.contacts && <p className="text-xs text-gray-400">{fmt.name((a.contacts as any).first_name, (a.contacts as any).last_name)}</p>}
                    <p className="text-xs text-gray-400">{fmt.dateTime(a.start_time)}</p>
                  </div>
                </div>
              ))}
              {appointments.length === 0 && <p className="text-xs text-gray-400">No upcoming appointments</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="font-bold text-dark-800 mb-3">Upcoming Task Deadlines</h3>
            <div className="space-y-2">
              {tasks.slice(0, 8).map(t => (
                <div key={t.id} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle size={13} className="text-gold-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-dark-800 truncate">{t.title}</p>
                    {t.contacts && <p className="text-xs text-gray-400">{fmt.name((t.contacts as any).first_name, (t.contacts as any).last_name)}</p>}
                    <p className="text-xs text-gray-400">{fmt.date(t.due_date)}</p>
                  </div>
                </div>
              ))}
              {tasks.length === 0 && <p className="text-xs text-gray-400">No upcoming task deadlines</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
