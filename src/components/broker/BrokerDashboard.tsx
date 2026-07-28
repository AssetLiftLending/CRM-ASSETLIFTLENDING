'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New Inquiry',
  contacted: 'Contacted',
  just_searching: 'Just Searching',
  dead_lead: 'Dead Lead',
  in_progress: 'In Progress',
  funded: 'Funded',
}

const STAGE_COLORS: Record<string, string> = {
  new_inquiry: 'bg-blue-900/40 text-blue-300 border-blue-800',
  contacted: 'bg-purple-900/40 text-purple-300 border-purple-800',
  just_searching: 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  dead_lead: 'bg-red-900/40 text-red-300 border-red-800',
  in_progress: 'bg-orange-900/40 text-orange-300 border-orange-800',
  funded: 'bg-green-900/40 text-green-300 border-green-800',
}

const LOAN_PROGRAMS = ['Fix & Flip', 'DSCR', 'Ground-Up Construction', 'Commercial Bridge', 'Multifamily']

const DOC_TYPES = [
  { key: 'government_id', label: 'Government-Issued ID' },
  { key: 'purchase_contract', label: 'Signed Purchase Contract' },
  { key: 'bank_statement', label: 'Recent Bank Statement' },
  { key: 'scope_of_work', label: 'Scope of Work' },
  { key: 'reo_experience', label: 'REO Experience Form' },
  { key: 'llc_documents', label: 'LLC Documents' },
  { key: 'insurance', label: 'Insurance Agent Info' },
  { key: 'title_company', label: 'Title Company Info' },
  { key: 'ssn', label: 'Social Security Number' },
  { key: 'appraisal', label: 'Appraisal (if available)' },
]

type Deal = {
  id: string
  stage: string
  loan_program: string
  property_address: string
  purchase_price: number | null
  loan_amount: number | null
  arv: number | null
  term_sheet_url: string | null
  rate: number | null
  points: number | null
  ltv: number | null
  term_months: number | null
  created_at: string
  contacts: { first_name: string; last_name: string; email: string; phone: string | null }
  documents: { doc_type: string; status: string }[]
}

export default function BrokerDashboard({
  profile,
  initialDeals,
}: {
  profile: { full_name: string; company_name: string | null; email: string; approved: boolean }
  initialDeals: Deal[]
}) {
  const router = useRouter()
  const [view, setView] = useState<'deals' | 'submit'>('deals')
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)

  const [form, setForm] = useState({
    borrower_first_name: '', borrower_last_name: '', borrower_email: '', borrower_phone: '',
    loan_program: '', property_address: '', purchase_price: '', rehab_amount: '',
    arv: '', loan_amount: '', experience: '', notes: '',
  })

  function setF(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function handleSignOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/broker/login')
  }

  async function handleSubmitDeal(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/broker/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setSubmitSuccess(true)
      // Refresh deals
      const dealsRes = await fetch('/api/broker/deals')
      const data = await dealsRes.json()
      setDeals(data.deals ?? [])
      setTimeout(() => {
        setSubmitSuccess(false)
        setView('deals')
        setForm({ borrower_first_name: '', borrower_last_name: '', borrower_email: '', borrower_phone: '',
          loan_program: '', property_address: '', purchase_price: '', rehab_amount: '',
          arv: '', loan_amount: '', experience: '', notes: '' })
      }, 2500)
    } catch {
      alert('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function uploadDoc(dealId: string, contactId: string, docType: string, file: File) {
    setUploadingDoc(docType)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('deal_id', dealId)
      fd.append('contact_id', contactId)
      fd.append('doc_type', docType)
      await fetch('/api/documents/upload', { method: 'POST', body: fd })
      // Refresh deals
      const res = await fetch('/api/broker/deals')
      const data = await res.json()
      setDeals(data.deals ?? [])
      // Update selected deal
      if (selectedDeal?.id === dealId) {
        const updated = (data.deals ?? []).find((d: Deal) => d.id === dealId)
        if (updated) setSelectedDeal(updated)
      }
    } finally {
      setUploadingDoc(null)
    }
  }

  const fmt = (n: number | null) => n ? `$${n.toLocaleString()}` : '—'

  // Deal detail view
  if (selectedDeal) {
    const contact = selectedDeal.contacts
    const docs = selectedDeal.documents ?? []
    const approvedDocs = docs.filter(d => d.status === 'approved').length
    const pct = Math.round((approvedDocs / DOC_TYPES.length) * 100)

    return (
      <div className="min-h-screen bg-[#1A1A1A] text-white">
        {/* Header */}
        <header className="bg-[#111] border-b border-gray-800 px-6 py-4 flex items-center gap-4">
          <button onClick={() => setSelectedDeal(null)} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="font-bold text-lg">{contact.first_name} {contact.last_name}</h1>
            <p className="text-gray-400 text-sm">{selectedDeal.property_address}</p>
          </div>
          <span className={`ml-auto px-3 py-1 rounded-full border text-xs font-medium ${STAGE_COLORS[selectedDeal.stage] ?? 'bg-gray-800 text-gray-300 border-gray-700'}`}>
            {STAGE_LABELS[selectedDeal.stage] ?? selectedDeal.stage}
          </span>
        </header>

        <div className="max-w-4xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Deal Info */}
          <div className="bg-[#111] rounded-xl border border-gray-800 p-6">
            <h2 className="text-[#D4A017] font-semibold text-sm mb-4 uppercase tracking-wide">Deal Information</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Loan Program</span>
                <span className="text-white font-medium">{selectedDeal.loan_program || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Purchase Price</span>
                <span className="text-white">{fmt(selectedDeal.purchase_price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Loan Amount</span>
                <span className="text-white">{fmt(selectedDeal.loan_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">ARV</span>
                <span className="text-white">{fmt(selectedDeal.arv)}</span>
              </div>
            </div>

            {/* Term Sheet / Loan Terms */}
            {(selectedDeal.rate || selectedDeal.term_sheet_url) && (
              <div className="mt-6 pt-5 border-t border-gray-800">
                <h2 className="text-[#D4A017] font-semibold text-sm mb-4 uppercase tracking-wide">Loan Terms</h2>
                <div className="space-y-3 text-sm">
                  {selectedDeal.rate && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Interest Rate</span>
                      <span className="text-white font-medium">{selectedDeal.rate}%</span>
                    </div>
                  )}
                  {selectedDeal.points && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Points</span>
                      <span className="text-white">{selectedDeal.points}</span>
                    </div>
                  )}
                  {selectedDeal.ltv && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">LTV</span>
                      <span className="text-white">{selectedDeal.ltv}%</span>
                    </div>
                  )}
                  {selectedDeal.term_months && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Term</span>
                      <span className="text-white">{selectedDeal.term_months} months</span>
                    </div>
                  )}
                </div>
                {selectedDeal.term_sheet_url && (
                  <a href={selectedDeal.term_sheet_url} target="_blank"
                    className="mt-4 flex items-center gap-2 bg-[#D4A017]/10 border border-[#D4A017]/30 rounded-lg px-4 py-3 text-[#D4A017] text-sm font-medium hover:bg-[#D4A017]/20 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Term Sheet
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Borrower Info */}
          <div className="bg-[#111] rounded-xl border border-gray-800 p-6">
            <h2 className="text-[#D4A017] font-semibold text-sm mb-4 uppercase tracking-wide">Borrower</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Name</span>
                <span className="text-white">{contact.first_name} {contact.last_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Email</span>
                <span className="text-white">{contact.email}</span>
              </div>
              {contact.phone && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Phone</span>
                  <span className="text-white">{contact.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Document Checklist */}
          <div className="bg-[#111] rounded-xl border border-gray-800 p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[#D4A017] font-semibold text-sm uppercase tracking-wide">Document Checklist</h2>
              <span className="text-gray-400 text-sm">{approvedDocs} / {DOC_TYPES.length} approved</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 mb-5">
              <div className="bg-[#D4A017] h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DOC_TYPES.map(({ key, label }) => {
                const doc = docs.find(d => d.doc_type === key)
                const status = doc?.status ?? 'missing'
                return (
                  <div key={key} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        status === 'approved' ? 'bg-green-500' :
                        status === 'pending' ? 'bg-yellow-500' : 'bg-gray-600'
                      }`} />
                      <span className="text-sm text-gray-300">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        status === 'approved' ? 'bg-green-900/40 text-green-400' :
                        status === 'pending' ? 'bg-yellow-900/40 text-yellow-400' :
                        'bg-gray-800 text-gray-500'
                      }`}>
                        {status === 'missing' ? 'Missing' : status === 'pending' ? 'Pending' : 'Approved'}
                      </span>
                      {status !== 'approved' && (
                        <label className="cursor-pointer">
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={e => {
                              const f = e.target.files?.[0]
                              if (f) uploadDoc(selectedDeal.id, selectedDeal.contacts as any, key, f)
                            }} />
                          <span className={`text-xs px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:border-[#D4A017] hover:text-[#D4A017] transition-colors ${uploadingDoc === key ? 'opacity-50' : ''}`}>
                            {uploadingDoc === key ? '…' : 'Upload'}
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white">
      {/* Header */}
      <header className="bg-[#111] border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#D4A017] rounded-full flex items-center justify-center text-black font-black text-sm">A</div>
          <div>
            <p className="font-bold text-sm">Asset Lift Lending</p>
            <p className="text-gray-500 text-xs">Broker Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">{profile.full_name}</p>
            <p className="text-gray-500 text-xs">{profile.company_name || profile.email}</p>
          </div>
          <button onClick={handleSignOut} className="text-gray-400 hover:text-white text-sm">Sign Out</button>
        </div>
      </header>

      {/* Nav */}
      <div className="bg-[#111] border-b border-gray-800 px-6">
        <div className="flex gap-0">
          {[
            { id: 'deals', label: 'My Deals' },
            { id: 'submit', label: 'Submit New Deal' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id as any)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                view === tab.id
                  ? 'border-[#D4A017] text-[#D4A017]'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {/* Deals List */}
        {view === 'deals' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold">My Deals</h1>
              <span className="text-gray-500 text-sm">{deals.length} total</span>
            </div>

            {deals.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="font-medium">No deals yet</p>
                <p className="text-sm mt-1">Submit your first deal to get started.</p>
                <button onClick={() => setView('submit')} className="mt-4 bg-[#D4A017] text-black font-bold px-5 py-2 rounded-lg text-sm hover:bg-[#E5B828]">
                  Submit a Deal
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {deals.map(deal => {
                  const contact = deal.contacts
                  const docs = deal.documents ?? []
                  const approvedDocs = docs.filter(d => d.status === 'approved').length
                  return (
                    <button key={deal.id} onClick={() => setSelectedDeal(deal)}
                      className="w-full text-left bg-[#111] border border-gray-800 rounded-xl p-5 hover:border-[#D4A017]/40 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <p className="font-semibold">{contact.first_name} {contact.last_name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${STAGE_COLORS[deal.stage] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                              {STAGE_LABELS[deal.stage] ?? deal.stage}
                            </span>
                          </div>
                          <p className="text-gray-400 text-sm">{deal.property_address}</p>
                          <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            <span>{deal.loan_program}</span>
                            {deal.purchase_price && <span>Purchase: {fmt(deal.purchase_price)}</span>}
                            {deal.loan_amount && <span>Loan: {fmt(deal.loan_amount)}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-500 mb-2">Docs</p>
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 bg-gray-800 rounded-full h-1.5">
                              <div className="bg-[#D4A017] h-1.5 rounded-full" style={{ width: `${(approvedDocs / 10) * 100}%` }} />
                            </div>
                            <span className="text-xs text-gray-400">{approvedDocs}/10</span>
                          </div>
                          {deal.term_sheet_url && (
                            <span className="text-xs text-green-400 mt-1 block">Term sheet ready</span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Submit Deal Form */}
        {view === 'submit' && (
          <div className="max-w-2xl">
            <h1 className="text-xl font-bold mb-6">Submit a New Deal</h1>

            {submitSuccess && (
              <div className="mb-6 p-4 bg-green-900/30 border border-green-700 rounded-xl text-green-400 text-sm font-medium">
                ✓ Deal submitted! Our team has been notified and will review it shortly.
              </div>
            )}

            <form onSubmit={handleSubmitDeal} className="space-y-6">
              {/* Borrower Info */}
              <div className="bg-[#111] border border-gray-800 rounded-xl p-5">
                <h2 className="text-[#D4A017] text-sm font-semibold uppercase tracking-wide mb-4">Borrower Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1.5">First Name *</label>
                    <input required value={form.borrower_first_name} onChange={e => setF('borrower_first_name', e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                      placeholder="John" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1.5">Last Name *</label>
                    <input required value={form.borrower_last_name} onChange={e => setF('borrower_last_name', e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                      placeholder="Smith" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1.5">Email *</label>
                    <input required type="email" value={form.borrower_email} onChange={e => setF('borrower_email', e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                      placeholder="john@example.com" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1.5">Phone</label>
                    <input type="tel" value={form.borrower_phone} onChange={e => setF('borrower_phone', e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                      placeholder="+1 (555) 000-0000" />
                  </div>
                </div>
              </div>

              {/* Deal Details */}
              <div className="bg-[#111] border border-gray-800 rounded-xl p-5">
                <h2 className="text-[#D4A017] text-sm font-semibold uppercase tracking-wide mb-4">Deal Details</h2>
                <div className="mb-4">
                  <label className="block text-gray-400 text-xs mb-2">Loan Program *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {LOAN_PROGRAMS.map(p => (
                      <button key={p} type="button" onClick={() => setF('loan_program', p)}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left
                          ${form.loan_program === p ? 'border-[#D4A017] bg-[#D4A017]/10 text-[#D4A017]' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">Property Address *</label>
                  <input required value={form.property_address} onChange={e => setF('property_address', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                    placeholder="123 Main St, City, State 12345" />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {[
                    { key: 'purchase_price', label: 'Purchase Price' },
                    { key: 'rehab_amount', label: 'Rehab Amount' },
                    { key: 'arv', label: 'After Repair Value (ARV)' },
                    { key: 'loan_amount', label: 'Loan Amount Requested' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-gray-400 text-xs mb-1.5">{label}</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500 text-sm">$</span>
                        <input type="number" value={(form as any)[key]} onChange={e => setF(key, e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                          placeholder="0" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="block text-gray-400 text-xs mb-1.5">Borrower Experience</label>
                  <select value={form.experience} onChange={e => setF('experience', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]">
                    <option value="">Select</option>
                    <option value="0">First-time investor</option>
                    <option value="1-3">1–3 deals</option>
                    <option value="4-10">4–10 deals</option>
                    <option value="10+">10+ deals</option>
                  </select>
                </div>
                <div className="mt-4">
                  <label className="block text-gray-400 text-xs mb-1.5">Additional Notes</label>
                  <textarea value={form.notes} onChange={e => setF('notes', e.target.value)} rows={3}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017] resize-none"
                    placeholder="Anything Asset Lift Lending should know..." />
                </div>
              </div>

              <button type="submit" disabled={submitting || !form.loan_program || !form.property_address}
                className="w-full bg-[#D4A017] text-black font-bold py-3 rounded-xl hover:bg-[#E5B828] transition-colors disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Submit Deal to Asset Lift Lending'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
