'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Phone, MessageSquare, Mail, MessageCircle, ChevronLeft, Plus,
  CheckCircle, Circle, Clock, FileText, User, Briefcase, Activity,
  Edit2, Save, X, ExternalLink
} from 'lucide-react'
import toast from 'react-hot-toast'
import { fmt, STAGE_COLORS, PRIORITY_COLORS } from '@/lib/utils/format'

type Contact = Record<string, any>
type Deal    = Record<string, any>
type Comm    = Record<string, any>
type Task    = Record<string, any>
type Doc     = Record<string, any>

interface Props { contact: Contact; deals: Deal[]; comms: Comm[]; tasks: Task[]; docs: Doc[] }

const TABS = ['Overview', 'Deals', 'Communications', 'Tasks', 'Documents'] as const
type Tab = typeof TABS[number]

const COMM_ICONS: Record<string, React.ReactNode> = {
  call:      <Phone size={14} />,
  sms:       <MessageSquare size={14} />,
  email:     <Mail size={14} />,
  whatsapp:  <MessageCircle size={14} />,
  note:      <FileText size={14} />,
}

export default function ContactDetailClient({ contact, deals, comms, tasks, docs }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('Overview')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    first_name: contact.first_name ?? '',
    last_name:  contact.last_name  ?? '',
    email:      contact.email      ?? '',
    phone:      contact.phone      ?? '',
    cell_phone: contact.cell_phone ?? '',
    tags:       (contact.tags ?? []).join(', '),
  })
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', due_date: '' })
  const [addingTask, setAddingTask] = useState(false)

  async function saveContact() {
    setSaving(true)
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      }),
    })
    setSaving(false)
    if (res.ok) { toast.success('Contact saved'); setEditing(false); router.refresh() }
    else toast.error('Save failed')
  }

  async function addNote() {
    if (!note.trim()) return
    setAddingNote(true)
    await fetch('/api/communications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contact.id, type: 'note', body: note }),
    })
    setNote('')
    setAddingNote(false)
    toast.success('Note added')
    router.refresh()
  }

  async function quickCall() {
    const res = await fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contact.id, to: contact.phone }),
    })
    if (res.ok) toast.success('Calling…')
    else toast.error('Call failed')
  }

  async function quickSms() {
    const msg = prompt('SMS message:')
    if (!msg) return
    await fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contact.id, to: contact.phone, body: msg }),
    })
    toast.success('SMS sent')
  }

  async function createTask() {
    if (!taskForm.title) return
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contact.id, ...taskForm }),
    })
    setTaskForm({ title: '', due_date: '' })
    setAddingTask(false)
    toast.success('Task created')
    router.refresh()
  }

  async function toggleTask(id: string, done: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: done ? 'pending' : 'completed' }),
    })
    router.refresh()
  }

  const name = fmt.name(contact.first_name, contact.last_name)
  const initials = fmt.initials(contact.first_name, contact.last_name)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <Link href="/contacts" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gold-600 transition-colors">
        <ChevronLeft size={16} /> Back to Contacts
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gold-500 flex items-center justify-center text-dark-800 font-black text-xl flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {(['first_name', 'last_name', 'email', 'phone', 'cell_phone'] as const).map(f => (
                    <input key={f} value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                      placeholder={f.replace(/_/g, ' ')}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500" />
                  ))}
                  <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                    placeholder="Tags (comma-separated)"
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500 col-span-2" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveContact} disabled={saving}
                    className="flex items-center gap-1.5 bg-gold-500 text-dark-800 font-bold px-4 py-2 rounded-xl text-sm">
                    <Save size={14} /> {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-black text-dark-800">{name}</h1>
                  <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gold-600 transition-colors">
                    <Edit2 size={15} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mb-3">
                  {contact.email && <span>{contact.email}</span>}
                  {contact.phone && <span>{fmt.phone(contact.phone)}</span>}
                  {contact.cell_phone && <span>Cell: {fmt.phone(contact.cell_phone)}</span>}
                </div>
                {contact.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.map((t: string) => (
                      <span key={t} className="text-xs bg-gold-50 border border-gold-200 text-gold-700 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {/* Quick Actions */}
          {!editing && (
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={quickCall} title="Call"
                className="w-9 h-9 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors">
                <Phone size={16} />
              </button>
              <button onClick={quickSms} title="SMS"
                className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors">
                <MessageSquare size={16} />
              </button>
              <Link href={`/communications?contact=${contact.id}`}
                className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 hover:bg-purple-100 flex items-center justify-center transition-colors">
                <Mail size={16} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-base
              ${tab === t ? 'bg-white text-dark-800 shadow-sm' : 'text-gray-500 hover:text-dark-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'Overview' && (
        <div className="grid grid-cols-3 gap-5">
          {/* Contact Info */}
          <div className="col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-dark-800 mb-4 flex items-center gap-2"><User size={16} className="text-gold-500" /> Contact Info</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  ['Lead Source', fmt.stage(contact.lead_source ?? '')],
                  ['Assigned To', (contact.profiles as any)?.full_name ?? '—'],
                  ['Created', fmt.date(contact.created_at)],
                  ['Last Updated', fmt.relativeTime(contact.updated_at)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-gray-400 text-xs mb-0.5">{k}</dt>
                    <dd className="font-medium text-dark-800">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-dark-800 mb-4 flex items-center gap-2"><Activity size={16} className="text-gold-500" /> Recent Activity</h3>
              <div className="space-y-3">
                {comms.slice(0, 8).map((c: Comm) => (
                  <div key={c.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 text-gray-400">{COMM_ICONS[c.type] ?? <Activity size={14} />}</span>
                    <div className="flex-1 min-w-0">
                      <span className="capitalize font-medium text-dark-800">{c.type}</span>
                      {c.body && <span className="text-gray-500 ml-2 truncate">{c.body.slice(0, 80)}</span>}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{fmt.relativeTime(c.created_at)}</span>
                  </div>
                ))}
                {comms.length === 0 && <p className="text-sm text-gray-400">No activity yet</p>}
              </div>
            </div>

            {/* Add Note */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-dark-800 mb-3 flex items-center gap-2"><FileText size={16} className="text-gold-500" /> Add Note</h3>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Write a note about this contact…"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold-500 resize-none" />
              <button onClick={addNote} disabled={addingNote || !note.trim()}
                className="mt-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800 font-bold px-4 py-2 rounded-xl text-sm">
                {addingNote ? 'Saving…' : 'Save Note'}
              </button>
            </div>
          </div>

          {/* Sidebar: Deals summary */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-dark-800 mb-3 flex items-center gap-2"><Briefcase size={16} className="text-gold-500" /> Deals ({deals.length})</h3>
              <div className="space-y-2">
                {deals.map(d => (
                  <Link key={d.id} href={`/deals/${d.id}`}
                    className="block p-3 bg-gray-50 rounded-xl hover:bg-gold-50 transition-colors group">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${STAGE_COLORS[d.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                        {fmt.stage(d.stage)}
                      </span>
                      <ExternalLink size={12} className="text-gray-300 group-hover:text-gold-500 transition-colors" />
                    </div>
                    <div className="text-xs text-gray-500">{fmt.loanProgram(d.loan_program)}</div>
                    {d.loan_amount && <div className="text-sm font-bold text-dark-800 mt-0.5">{fmt.currency(d.loan_amount)}</div>}
                  </Link>
                ))}
                {deals.length === 0 && <p className="text-xs text-gray-400">No deals yet</p>}
                <Link href={`/pipeline?contact=${contact.id}`}
                  className="block text-center text-xs text-gold-600 hover:text-gold-700 font-medium mt-2">
                  + New Deal
                </Link>
              </div>
            </div>

            {/* Upcoming Tasks */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-dark-800 mb-3 flex items-center gap-2"><Clock size={16} className="text-gold-500" /> Tasks</h3>
              <div className="space-y-2">
                {tasks.filter(t => t.status !== 'completed').slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-start gap-2 text-sm">
                    <button onClick={() => toggleTask(t.id, t.status === 'completed')} className="mt-0.5 text-gray-300 hover:text-green-500">
                      <Circle size={14} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-dark-800 text-xs font-medium truncate">{t.title}</p>
                      {t.due_date && <p className="text-xs text-gray-400">{fmt.date(t.due_date)}</p>}
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${PRIORITY_COLORS[t.priority] ?? ''}`}>
                      {t.priority}
                    </span>
                  </div>
                ))}
                {tasks.filter(t => t.status !== 'completed').length === 0 && <p className="text-xs text-gray-400">No open tasks</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deals Tab */}
      {tab === 'Deals' && (
        <div className="space-y-4">
          {deals.map(d => (
            <Link key={d.id} href={`/deals/${d.id}`}
              className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-gold-200 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${STAGE_COLORS[d.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                    {fmt.stage(d.stage)}
                  </span>
                  <span className="text-sm text-gray-500">{fmt.loanProgram(d.loan_program)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Clock size={12} /> {fmt.relativeTime(d.created_at)}
                  <ExternalLink size={12} className="text-gold-500 ml-1" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm">
                {[
                  ['Loan Amount', d.loan_amount ? fmt.currency(d.loan_amount) : '—'],
                  ['Purchase Price', d.purchase_price ? fmt.currency(d.purchase_price) : '—'],
                  ['Rehab Budget', d.rehab_amount ? fmt.currency(d.rehab_amount) : '—'],
                  ['Property', d.property_address ?? '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-gray-400 mb-0.5">{k}</p>
                    <p className="font-medium text-dark-800">{v}</p>
                  </div>
                ))}
              </div>
            </Link>
          ))}
          {deals.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <p className="text-gray-400">No deals yet for this contact.</p>
            </div>
          )}
        </div>
      )}

      {/* Communications Tab */}
      {tab === 'Communications' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-dark-800">Communication History</h3>
            <Link href={`/communications?contact=${contact.id}`}
              className="text-sm text-gold-600 hover:text-gold-700 font-medium flex items-center gap-1">
              Open in Communications <ExternalLink size={13} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {comms.map(c => (
              <div key={c.id} className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
                  ${c.type === 'call' ? 'bg-green-50 text-green-600' : c.type === 'sms' ? 'bg-blue-50 text-blue-600' : c.type === 'email' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                  {COMM_ICONS[c.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-dark-800 capitalize">{c.type}</span>
                    {c.direction && <span className="text-xs text-gray-400">({c.direction})</span>}
                    {c.status && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 rounded-full">{c.status}</span>}
                  </div>
                  {c.body && <p className="text-sm text-gray-600 line-clamp-2">{c.body}</p>}
                  {c.ai_summary && <p className="text-xs text-gold-700 mt-1 italic">{c.ai_summary}</p>}
                  {c.recording_url && (
                    <audio controls className="mt-2 h-8 w-full max-w-sm" src={c.recording_url} />
                  )}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{fmt.relativeTime(c.created_at)}</span>
              </div>
            ))}
            {comms.length === 0 && (
              <div className="p-10 text-center text-gray-400">No communications yet</div>
            )}
          </div>
        </div>
      )}

      {/* Tasks Tab */}
      {tab === 'Tasks' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-dark-800">Tasks</h3>
            <button onClick={() => setAddingTask(true)} className="flex items-center gap-1.5 text-sm text-gold-600 hover:text-gold-700 font-medium">
              <Plus size={14} /> Add Task
            </button>
          </div>
          {addingTask && (
            <div className="p-4 border-b border-gray-100 bg-gold-50 flex items-center gap-3">
              <input value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Task title…" autoFocus
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500" />
              <input type="date" value={taskForm.due_date} onChange={e => setTaskForm(p => ({ ...p, due_date: e.target.value }))}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500" />
              <button onClick={createTask} className="bg-gold-500 text-dark-800 font-bold px-4 py-2 rounded-xl text-sm">Save</button>
              <button onClick={() => setAddingTask(false)} className="text-gray-400"><X size={16} /></button>
            </div>
          )}
          <div className="divide-y divide-gray-50">
            {tasks.map(t => (
              <div key={t.id} className={`flex items-center gap-3 p-4 ${t.status === 'completed' ? 'opacity-50' : ''}`}>
                <button onClick={() => toggleTask(t.id, t.status === 'completed')} className="text-gray-300 hover:text-green-500 transition-colors">
                  {t.status === 'completed' ? <CheckCircle size={18} className="text-green-500" /> : <Circle size={18} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${t.status === 'completed' ? 'line-through text-gray-400' : 'text-dark-800'}`}>{t.title}</p>
                  {t.due_date && <p className="text-xs text-gray-400">{fmt.date(t.due_date)}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${PRIORITY_COLORS[t.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                  {t.priority}
                </span>
                <span className="text-xs text-gray-400">{(t.profiles as any)?.full_name ?? 'Unassigned'}</span>
              </div>
            ))}
            {tasks.length === 0 && <div className="p-10 text-center text-gray-400">No tasks yet</div>}
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {tab === 'Documents' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-bold text-dark-800">Documents</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {docs.map(d => (
              <div key={d.id} className="flex items-center gap-4 p-4">
                <FileText size={18} className="text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-dark-800">{d.doc_type?.replace(/_/g, ' ')}</p>
                  {d.file_name && <p className="text-xs text-gray-400">{d.file_name}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold
                  ${d.status === 'approved' ? 'bg-green-100 text-green-700' : d.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                  {d.status}
                </span>
                {d.file_url && (
                  <a href={d.file_url} target="_blank" rel="noreferrer"
                    className="text-xs text-gold-600 hover:text-gold-700 flex items-center gap-1">
                    View <ExternalLink size={11} />
                  </a>
                )}
                <span className="text-xs text-gray-400">{fmt.relativeTime(d.created_at)}</span>
              </div>
            ))}
            {docs.length === 0 && <div className="p-10 text-center text-gray-400">No documents uploaded yet</div>}
          </div>
        </div>
      )}
    </div>
  )
}
