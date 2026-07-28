'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Filter, Phone, Mail, MessageSquare, MoreHorizontal } from 'lucide-react'
import { fmt, STAGE_COLORS } from '@/lib/utils/format'
import NewContactModal from './NewContactModal'

interface Contact {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  lead_source?: string
  created_at: string
  tags?: string[]
  deals?: Array<{ id: string; stage: string; loan_program: string; loan_amount?: number; title?: string }>
}

export default function ContactsClient({
  contacts,
  profiles,
  defaultNew,
}: {
  contacts: Contact[]
  profiles: Array<{ id: string; full_name: string | null }>
  defaultNew: boolean
}) {
  const [search, setSearch]     = useState('')
  const [stageFilter, setStage] = useState('')
  const [showNew, setShowNew]   = useState(defaultNew)

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    const matchStage = !stageFilter || c.deals?.some((d) => d.stage === stageFilter)
    return matchSearch && matchStage
  })

  const STAGES = [
    { value: '', label: 'All Stages' },
    { value: 'new_lead', label: 'New lead' },
    { value: 'pending_lead', label: 'Pending lead' },
    { value: 'dead_lead', label: 'Dead lead' },
    { value: 'in_progress', label: 'In the middle of progress' },
    { value: 'closed_deal', label: 'Closed deal' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-800">Contacts</h1>
          <p className="text-gray-500 text-sm mt-0.5">{contacts.length} total contacts</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-800 font-semibold text-sm px-4 py-2.5 rounded-xl transition-base"
        >
          <Plus size={16} /> New Contact
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3 shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-gold-500"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStage(e.target.value)}
          className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
        >
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3 uppercase tracking-wider">Contact</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">Phone / Email</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">Pipeline</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">Source</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">Added</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((c) => {
              const latestDeal = c.deals?.[0]
              return (
                <tr key={c.id} className="hover:bg-gray-50 transition-base">
                  <td className="px-5 py-3.5">
                    <Link href={`/contacts/${c.id}`} className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gold-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-gold-700 font-bold text-xs">{fmt.initials(c.first_name, c.last_name)}</span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-dark-800 hover:text-gold-600">
                          {fmt.name(c.first_name, c.last_name)}
                        </div>
                        {c.tags?.length ? (
                          <div className="flex gap-1 mt-0.5">
                            {c.tags.slice(0, 2).map((t) => (
                              <span key={t} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-sm text-dark-800">{fmt.phone(c.phone)}</div>
                    <div className="text-xs text-gray-400">{c.email ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    {latestDeal ? (
                      <div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[latestDeal.stage]}`}>
                          {fmt.stage(latestDeal.stage)}
                        </span>
                        <div className="text-xs text-gray-400 mt-1">{fmt.loanProgram(latestDeal.loan_program)}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No deal</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium capitalize">
                      {c.lead_source?.replace(/_/g, ' ') ?? 'Direct'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">{fmt.date(c.created_at)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      {c.phone && (
                        <a
                          href={`/communications?tab=call&contact=${c.id}`}
                          className="p-1.5 text-gray-400 hover:text-gold-500 hover:bg-gold-50 rounded-lg transition-base"
                          title="Call"
                        >
                          <Phone size={13} />
                        </a>
                      )}
                      {c.email && (
                        <a
                          href={`/communications?tab=email&contact=${c.id}`}
                          className="p-1.5 text-gray-400 hover:text-gold-500 hover:bg-gold-50 rounded-lg transition-base"
                          title="Email"
                        >
                          <Mail size={13} />
                        </a>
                      )}
                      {c.phone && (
                        <a
                          href={`/communications?tab=sms&contact=${c.id}`}
                          className="p-1.5 text-gray-400 hover:text-gold-500 hover:bg-gold-50 rounded-lg transition-base"
                          title="SMS"
                        >
                          <MessageSquare size={13} />
                        </a>
                      )}
                      <Link
                        href={`/contacts/${c.id}`}
                        className="p-1.5 text-gray-400 hover:text-dark-800 hover:bg-gray-100 rounded-lg transition-base"
                      >
                        <MoreHorizontal size={13} />
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-3xl mb-3">👥</div>
            <div className="font-medium">No contacts found</div>
            <div className="text-sm mt-1">Try adjusting your search or <button onClick={() => setShowNew(true)} className="text-gold-500 hover:underline">add a new lead</button></div>
          </div>
        )}
      </div>

      {showNew && <NewContactModal onClose={() => setShowNew(false)} profiles={profiles} />}
    </div>
  )
}
