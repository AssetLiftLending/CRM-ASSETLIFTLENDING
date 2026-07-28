'use client'

import { useState } from 'react'
import Link from 'next/link'
import { fmt } from '@/lib/utils/format'
import toast from 'react-hot-toast'
import { Phone, ArrowRight, Settings, Plus, Trash2, MessageSquare, Mail, MessageCircle, FileText, Play } from 'lucide-react'

const FALLBACK_STAGES = [
  { id: 'new_lead', key: 'new_lead', label: 'New lead', sort_order: 1, color: 'border-blue-300 bg-blue-50', is_closed: false },
  { id: 'pending_lead', key: 'pending_lead', label: 'Pending lead', sort_order: 2, color: 'border-yellow-300 bg-yellow-50', is_closed: false },
  { id: 'dead_lead', key: 'dead_lead', label: 'Dead lead', sort_order: 3, color: 'border-red-300 bg-red-50', is_closed: true },
  { id: 'in_progress', key: 'in_progress', label: 'In the middle of progress', sort_order: 4, color: 'border-gold-300 bg-gold-50', is_closed: false },
  { id: 'closed_deal', key: 'closed_deal', label: 'Closed deal', sort_order: 5, color: 'border-green-300 bg-green-50', is_closed: true },
]

interface Deal {
  id: string
  title?: string
  stage: string
  loan_program: string
  loan_amount?: number
  purchase_price?: number
  property_address?: string
  property_state?: string
  created_at: string
  updated_at: string
  contacts?: { id: string; first_name: string; last_name: string; phone?: string; email?: string } | null
  profiles?: { id: string; full_name: string } | null
}

interface Communication {
  id: string
  contact_id: string
  deal_id?: string | null
  type: string
  direction?: string | null
  subject?: string | null
  body?: string | null
  snippet?: string | null
  duration_secs?: number | null
  recording_url?: string | null
  transcript?: string | null
  ai_summary?: string | null
  status?: string | null
  from_number?: string | null
  to_number?: string | null
  from_email?: string | null
  to_email?: string | null
  created_at: string
}

interface Stage {
  id: string
  key: string
  label: string
  sort_order: number
  color: string
  is_closed: boolean
}

export default function PipelineBoard({
  deals: initialDeals,
  profiles,
  stages: initialStages,
  communications,
}: {
  deals: Deal[]
  profiles: Array<{ id: string; full_name: string | null }>
  stages: Stage[]
  communications: Communication[]
}) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [stages, setStages] = useState<Stage[]>(
    (initialStages.length ? initialStages : FALLBACK_STAGES).sort((a, b) => a.sort_order - b.sort_order)
  )
  const [dragId, setDragId] = useState<string | null>(null)
  const [programFilter, setFilter] = useState('')
  const [managing, setManaging] = useState(false)
  const [newStage, setNewStage] = useState('')

  const filtered = programFilter
    ? deals.filter((d) => d.loan_program === programFilter)
    : deals

  const byStage = (stage: string) => filtered.filter((d) => d.stage === stage)

  async function moveDeal(dealId: string, newStageKey: string) {
    const previousDeals = deals
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: newStageKey } : d)))

    const res = await fetch(`/api/deals/${dealId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStageKey }),
    })

    if (!res.ok) {
      toast.error('Failed to move deal')
      setDeals(previousDeals)
    } else {
      const stage = stages.find((s) => s.key === newStageKey)
      toast.success(`Moved to ${stage?.label ?? fmt.stage(newStageKey)}`)
    }
  }

  async function addStage() {
    const label = newStage.trim()
    if (!label) return

    const res = await fetch('/api/pipeline/stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error || 'Failed to add stage')
      return
    }

    setStages((current) => [...current, data.stage].sort((a, b) => a.sort_order - b.sort_order))
    setNewStage('')
    toast.success('Stage added')
  }

  async function updateStage(stage: Stage, update: Partial<Stage>) {
    const previousStages = stages
    const nextStage = { ...stage, ...update }
    setStages((current) => current.map((s) => (s.id === stage.id ? nextStage : s)).sort((a, b) => a.sort_order - b.sort_order))

    const res = await fetch('/api/pipeline/stages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: stage.id, ...update }),
    })

    if (!res.ok) {
      toast.error('Failed to update stage')
      setStages(previousStages)
    }
  }

  async function deleteStage(stage: Stage) {
    if (stages.length <= 1) {
      toast.error('Keep at least one stage')
      return
    }

    const fallback = stages.find((s) => s.id !== stage.id)?.key ?? 'new_lead'
    const res = await fetch(`/api/pipeline/stages?id=${stage.id}&fallback=${fallback}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Failed to delete stage')
      return
    }

    setStages((current) => current.filter((s) => s.id !== stage.id))
    setDeals((current) => current.map((deal) => deal.stage === stage.key ? { ...deal, stage: fallback } : deal))
    toast.success('Stage deleted')
  }

  const PROGRAMS = [
    { value: '', label: 'All Programs' },
    { value: 'fix_flip', label: 'Fix & Flip' },
    { value: 'dscr', label: 'DSCR' },
    { value: 'ground_up', label: 'Ground-Up' },
    { value: 'commercial', label: 'Commercial' },
    { value: 'multifamily', label: 'Multifamily' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-800">Pipeline</h1>
          <p className="text-gray-500 text-sm">{deals.length} total deals - drag to move</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={programFilter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
          >
            {PROGRAMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <Link href="/contacts?new=1" className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-800 font-semibold text-sm px-4 py-2 rounded-xl transition-base">
            + New Lead
          </Link>
          <button onClick={() => setManaging((value) => !value)} className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gold-300 text-dark-800 font-semibold text-sm px-4 py-2 rounded-xl transition-base">
            <Settings size={15} /> Stages
          </button>
        </div>
      </div>

      {managing && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-dark-800">Pipeline Stages</h2>
            <div className="flex items-center gap-2">
              <input
                value={newStage}
                onChange={(event) => setNewStage(event.target.value)}
                placeholder="New stage name"
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
              />
              <button onClick={addStage} className="p-2 bg-gold-500 hover:bg-gold-400 text-dark-800 rounded-xl" title="Add stage">
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {stages.map((stage) => (
              <div key={stage.id} className="flex items-center gap-2 border border-gray-100 rounded-xl p-2">
                <input
                  value={stage.label}
                  onChange={(event) => updateStage(stage, { label: event.target.value })}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-gold-500"
                />
                <input
                  type="number"
                  value={stage.sort_order}
                  onChange={(event) => updateStage(stage, { sort_order: Number(event.target.value) })}
                  className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-gold-500"
                  aria-label={`${stage.label} order`}
                />
                <label className="flex items-center gap-1 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={stage.is_closed}
                    onChange={(event) => updateStage(stage, { is_closed: event.target.checked })}
                  />
                  Closed
                </label>
                <button onClick={() => deleteStage(stage)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg" title="Delete stage">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageDeals = byStage(stage.key)
          const totalValue = stageDeals.reduce((sum, d) => sum + (d.loan_amount ?? 0), 0)

          return (
            <div
              key={stage.id}
              className={`flex-shrink-0 w-64 rounded-2xl border-2 ${stage.color || 'border-gray-300 bg-gray-50'} flex flex-col`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (dragId) moveDeal(dragId, stage.key)
              }}
            >
              <div className="p-3 border-b border-black/5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{stage.label}</span>
                  <span className="bg-white text-dark-800 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-sm">
                    {stageDeals.length}
                  </span>
                </div>
                {totalValue > 0 && <div className="text-xs text-gray-500 font-medium">{fmt.currency(totalValue)}</div>}
              </div>

              <div className="p-2 space-y-2 flex-1 min-h-[200px]">
                {stageDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    communications={communications.filter((comm) => comm.contact_id === deal.contacts?.id)}
                    onDragStart={() => setDragId(deal.id)}
                    onDragEnd={() => setDragId(null)}
                  />
                ))}
                {stageDeals.length === 0 && <div className="text-center py-8 text-xs text-gray-400">Drop deals here</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DealCard({
  deal,
  communications,
  onDragStart,
  onDragEnd,
}: {
  deal: Deal
  communications: Communication[]
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const contact = deal.contacts
  const name = contact ? fmt.name(contact.first_name, contact.last_name) : 'Unknown'
  const [showComms, setShowComms] = useState(false)
  const latestCommunication = communications[0]
  const latestPreview = latestCommunication
    ? latestCommunication.subject || latestCommunication.body || latestCommunication.snippet || latestCommunication.ai_summary || latestCommunication.transcript
    : null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md hover:border-gold-300 transition-base group"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs bg-gold-50 text-gold-700 border border-gold-200 px-2 py-0.5 rounded-full font-medium">
          {fmt.loanProgram(deal.loan_program)}
        </span>
        {deal.loan_amount && <span className="text-xs font-bold text-dark-800">{fmt.currency(deal.loan_amount)}</span>}
      </div>

      <Link href={`/deals/${deal.id}`} className="block">
        <div className="text-sm font-semibold text-dark-800 group-hover:text-gold-600 transition-base">{name}</div>
        {deal.property_address && <div className="text-xs text-gray-400 mt-0.5 truncate">{deal.property_address}</div>}
      </Link>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
        <span className="text-xs text-gray-400">{fmt.relativeTime(deal.updated_at)}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-base">
          {contact?.phone && (
            <a href={`/communications?tab=call&contact=${contact.id}`} className="p-1 text-gray-400 hover:text-gold-500 rounded-lg transition-base" title="Call">
              <Phone size={12} />
            </a>
          )}
          <Link href={`/deals/${deal.id}`} className="p-1 text-gray-400 hover:text-gold-500 rounded-lg transition-base" title="View">
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {contact && (
        <div className="mt-2 rounded-xl border border-gold-200 bg-gold-50">
          <button
            type="button"
            onClick={() => setShowComms((value) => !value)}
            className="flex w-full items-center justify-between px-2.5 py-2 text-left text-xs font-bold text-dark-800 hover:bg-gold-100 transition-base"
          >
            <span className="flex items-center gap-1.5">
              <MessageSquare size={13} />
              View Communications
            </span>
            <span className="rounded-full bg-white px-2 py-0.5 text-gold-700 shadow-sm">{communications.length}</span>
          </button>
          {latestCommunication && (
            <button
              type="button"
              onClick={() => setShowComms(true)}
              className="block w-full border-t border-gold-100 px-2.5 py-1.5 text-left text-[11px] text-gray-600 hover:bg-white/70"
            >
              <span className="font-semibold capitalize text-dark-800">{latestCommunication.type}</span>
              <span className="ml-1 text-gray-400">{fmt.relativeTime(latestCommunication.created_at)}</span>
              {latestPreview && <span className="mt-0.5 block truncate">{latestPreview}</span>}
            </button>
          )}
        </div>
      )}

      {showComms && contact && (
        <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50 p-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-dark-800">Contact History</span>
            <Link
              href={`/communications?contact=${contact.id}`}
              className="text-xs font-medium text-gold-600 hover:text-gold-700"
            >
              Open
            </Link>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {communications.map((comm) => (
              <CommunicationRow key={comm.id} communication={comm} />
            ))}
            {!communications.length && (
              <div className="rounded-lg bg-white p-3 text-center text-xs text-gray-400">No communications yet</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CommunicationRow({ communication }: { communication: Communication }) {
  const Icon = getCommunicationIcon(communication.type)
  const preview = communication.subject || communication.body || communication.snippet || communication.ai_summary || communication.transcript

  return (
    <div className="rounded-lg bg-white p-2 text-xs">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 font-semibold text-dark-800">
          {Icon}
          <span className="capitalize">{communication.type}</span>
          {communication.direction && (
            <span className={`rounded px-1 py-0.5 text-[10px] font-bold ${communication.direction === 'inbound' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
              {communication.direction}
            </span>
          )}
        </span>
        <span className="shrink-0 text-[10px] text-gray-400">{fmt.relativeTime(communication.created_at)}</span>
      </div>
      {preview && <p className="line-clamp-3 text-gray-600">{preview}</p>}
      {communication.duration_secs ? (
        <div className="mt-1 text-[10px] font-medium text-gray-400">{fmt.callDuration(communication.duration_secs)}</div>
      ) : null}
      {communication.recording_url && (
        <a
          href={communication.recording_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-gold-600 hover:underline"
        >
          <Play size={10} /> Recording
        </a>
      )}
    </div>
  )
}

function getCommunicationIcon(type: string) {
  if (type === 'call') return <Phone size={12} className="text-green-600" />
  if (type === 'sms') return <MessageSquare size={12} className="text-blue-600" />
  if (type === 'email') return <Mail size={12} className="text-purple-600" />
  if (type === 'whatsapp') return <MessageCircle size={12} className="text-green-600" />
  return <FileText size={12} className="text-gray-500" />
}
