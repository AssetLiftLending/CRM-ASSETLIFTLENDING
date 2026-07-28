'use client'

import { useState } from 'react'
import Link from 'next/link'
import { fmt, STAGE_COLORS } from '@/lib/utils/format'
import toast from 'react-hot-toast'
import { Phone, ArrowRight } from 'lucide-react'

const STAGES = [
  { key: 'new_inquiry',    label: 'New Inquiry',     color: 'border-blue-300    bg-blue-50' },
  { key: 'contacted',      label: 'Contacted',       color: 'border-purple-300  bg-purple-50' },
  { key: 'just_searching', label: 'Just Searching',  color: 'border-yellow-300  bg-yellow-50' },
  { key: 'dead_lead',      label: 'Dead Lead',       color: 'border-red-300     bg-red-50' },
  { key: 'in_progress',    label: 'In Progress',     color: 'border-gold-300    bg-gold-50' },
  { key: 'funded',         label: 'Funded ✓',        color: 'border-green-300   bg-green-50' },
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
  contacts?: { id: string; first_name: string; last_name: string; phone?: string } | null
  profiles?: { id: string; full_name: string } | null
}

export default function PipelineBoard({
  deals: initialDeals,
  profiles,
}: {
  deals: Deal[]
  profiles: Array<{ id: string; full_name: string | null }>
}) {
  const [deals, setDeals]         = useState<Deal[]>(initialDeals)
  const [dragId, setDragId]       = useState<string | null>(null)
  const [programFilter, setFilter] = useState('')

  const filtered = programFilter
    ? deals.filter((d) => d.loan_program === programFilter)
    : deals

  const byStage = (stage: string) => filtered.filter((d) => d.stage === stage)

  async function moveDeal(dealId: string, newStage: string) {
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d))
    )
    const res = await fetch(`/api/deals/${dealId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })
    if (!res.ok) {
      toast.error('Failed to move deal')
      setDeals(initialDeals) // revert
    } else {
      toast.success(`Moved to ${fmt.stage(newStage)}`)
    }
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-800">Pipeline</h1>
          <p className="text-gray-500 text-sm">{deals.length} total deals — drag to move</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={programFilter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
          >
            {PROGRAMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <Link href="/contacts?new=1"
            className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-800 font-semibold text-sm px-4 py-2 rounded-xl transition-base">
            + New Deal
          </Link>
        </div>
      </div>

      {/* Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageDeals = byStage(stage.key)
          const totalValue = stageDeals.reduce((sum, d) => sum + (d.loan_amount ?? 0), 0)

          return (
            <div
              key={stage.key}
              className={`flex-shrink-0 w-64 rounded-2xl border-2 ${stage.color} flex flex-col`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (dragId) moveDeal(dragId, stage.key)
              }}
            >
              {/* Column header */}
              <div className="p-3 border-b border-black/5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{stage.label}</span>
                  <span className="bg-white text-dark-800 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-sm">
                    {stageDeals.length}
                  </span>
                </div>
                {totalValue > 0 && (
                  <div className="text-xs text-gray-500 font-medium">{fmt.currency(totalValue)}</div>
                )}
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 flex-1 min-h-[200px]">
                {stageDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onDragStart={() => setDragId(deal.id)}
                    onDragEnd={() => setDragId(null)}
                  />
                ))}
                {stageDeals.length === 0 && (
                  <div className="text-center py-8 text-xs text-gray-400">Drop deals here</div>
                )}
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
  onDragStart,
  onDragEnd,
}: {
  deal: Deal
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const contact = deal.contacts
  const name    = contact ? fmt.name(contact.first_name, contact.last_name) : 'Unknown'

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing
                 hover:shadow-md hover:border-gold-300 transition-base group"
    >
      {/* Loan program badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs bg-gold-50 text-gold-700 border border-gold-200 px-2 py-0.5 rounded-full font-medium">
          {fmt.loanProgram(deal.loan_program)}
        </span>
        {deal.loan_amount && (
          <span className="text-xs font-bold text-dark-800">{fmt.currency(deal.loan_amount)}</span>
        )}
      </div>

      {/* Contact name */}
      <Link href={`/deals/${deal.id}`} className="block">
        <div className="text-sm font-semibold text-dark-800 group-hover:text-gold-600 transition-base">{name}</div>
        {deal.property_address && (
          <div className="text-xs text-gray-400 mt-0.5 truncate">{deal.property_address}</div>
        )}
      </Link>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
        <span className="text-xs text-gray-400">{fmt.relativeTime(deal.updated_at)}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-base">
          {contact?.phone && (
            <a href={`/communications?tab=call&contact=${contact.id}`}
               className="p-1 text-gray-400 hover:text-gold-500 rounded-lg transition-base" title="Call">
              <Phone size={12} />
            </a>
          )}
          <Link href={`/deals/${deal.id}`}
            className="p-1 text-gray-400 hover:text-gold-500 rounded-lg transition-base" title="View">
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  )
}
