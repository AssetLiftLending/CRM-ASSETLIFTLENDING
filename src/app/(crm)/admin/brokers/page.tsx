'use client'
import { useEffect, useState } from 'react'

type Broker = {
  id: string
  full_name: string
  email: string
  phone: string | null
  company_name: string | null
  license_number: string | null
  approved: boolean
  approved_at: string | null
  created_at: string
  deal_count: number
}

export default function BrokersAdminPage() {
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/brokers')
    const data = await res.json()
    setBrokers(data.brokers ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAction(brokerId: string, action: 'approve' | 'deactivate') {
    setActing(brokerId)
    await fetch('/api/admin/brokers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broker_id: brokerId, action }),
    })
    await load()
    setActing(null)
  }

  const pending = brokers.filter(b => !b.approved)
  const approved = brokers.filter(b => b.approved)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Broker Partners</h1>
      <p className="text-gray-500 mb-8">Manage external broker accounts and approve new applications.</p>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">{pending.length}</span>
            Pending Approval
          </h2>
          <div className="space-y-3">
            {pending.map(broker => (
              <BrokerCard key={broker.id} broker={broker} acting={acting === broker.id}
                onApprove={() => handleAction(broker.id, 'approve')}
                onDeactivate={() => handleAction(broker.id, 'deactivate')} />
            ))}
          </div>
        </div>
      )}

      {/* Approved */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
          Active Brokers ({approved.length})
        </h2>
        {approved.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-gray-200">
            No approved brokers yet.
          </div>
        ) : (
          <div className="space-y-3">
            {approved.map(broker => (
              <BrokerCard key={broker.id} broker={broker} acting={acting === broker.id}
                onApprove={() => handleAction(broker.id, 'approve')}
                onDeactivate={() => handleAction(broker.id, 'deactivate')} />
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400">Loading brokers…</div>
      )}
    </div>
  )
}

function BrokerCard({ broker, acting, onApprove, onDeactivate }: {
  broker: Broker
  acting: boolean
  onApprove: () => void
  onDeactivate: () => void
}) {
  return (
    <div className={`bg-white rounded-xl border p-5 flex items-start justify-between gap-4 ${
      broker.approved ? 'border-gray-200' : 'border-yellow-200 bg-yellow-50/30'
    }`}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-[#D4A017]/20 rounded-full flex items-center justify-center text-[#D4A017] font-bold text-sm flex-shrink-0">
          {broker.full_name.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-gray-900">{broker.full_name}</p>
          {broker.company_name && <p className="text-gray-500 text-sm">{broker.company_name}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
            <span>{broker.email}</span>
            {broker.phone && <span>{broker.phone}</span>}
            {broker.license_number && <span>NMLS: {broker.license_number}</span>}
            <span>{broker.deal_count} deal{broker.deal_count !== 1 ? 's' : ''}</span>
            <span>Applied {new Date(broker.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {!broker.approved ? (
          <button onClick={onApprove} disabled={acting}
            className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
            {acting ? '…' : 'Approve'}
          </button>
        ) : (
          <button onClick={onDeactivate} disabled={acting}
            className="bg-red-50 text-red-600 border border-red-200 text-sm px-4 py-2 rounded-lg hover:bg-red-100 disabled:opacity-50 font-medium">
            {acting ? '…' : 'Deactivate'}
          </button>
        )}
      </div>
    </div>
  )
}
