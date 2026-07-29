'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle, Circle, Clock, Upload, FileText, CreditCard,
  LogOut, Home, Phone, Mail
} from 'lucide-react'
import toast from 'react-hot-toast'
import { fmt, STAGE_COLORS } from '@/lib/utils/format'
import { createBrowserClient } from '@/lib/supabase/client'

type Contact = Record<string, any>

const DOC_TYPES = [
  { key: 'government_id',        label: 'Government-Issued ID' },
  { key: 'ssn',                  label: 'Social Security Number' },
  { key: 'bank_statement',       label: 'Recent Bank Statement' },
  { key: 'purchase_contract',    label: 'Signed Purchase Contract' },
  { key: 'llc_documents',        label: 'LLC Documents' },
  { key: 'scope_of_work',        label: 'Scope of Work' },
  { key: 'reo_experience',       label: 'REO Experience Form' },
  { key: 'title_company_info',   label: 'Title Company Contact & Quote' },
  { key: 'insurance_agent_info', label: 'Insurance Agent Contact & Quote' },
  { key: 'appraisal_payment',    label: 'Appraisal Payment' },
] as const

const STAGE_STEPS = [
  { key: 'new_lead',      label: 'Application Received' },
  { key: 'pending_lead',  label: 'Pending Review' },
  { key: 'dead_lead',     label: 'Not Moving Forward' },
  { key: 'in_progress',   label: 'In Processing' },
  { key: 'closed_deal',   label: 'Closed Deal' },
] as const

export default function PortalDashboard({ contact }: { contact: Contact }) {
  const router    = useRouter()
  const supabase  = createBrowserClient()
  const [uploading, setUploading] = useState<string | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<number>(0)
  const [contactInfo, setContactInfo] = useState<Record<string, Record<string, string>>>({})

  const deals: any[] = contact.deals ?? []
  const deal  = deals[selectedDeal]
  const docs: any[] = deal?.documents ?? []
  const docMap = Object.fromEntries(docs.map((d: any) => [d.doc_type, d]))

  const activeStepIdx = STAGE_STEPS.findIndex(s => s.key === deal?.stage) ?? 0
  const approvedCount = docs.filter((d: any) => d.status === 'approved').length

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/portal/login')
  }

  function setInfo(docType: string, field: string, value: string) {
    setContactInfo((current) => ({
      ...current,
      [docType]: {
        ...(current[docType] ?? {}),
        [field]: value,
      },
    }))
  }

  async function uploadDoc(docType: string, file: File) {
    if (!deal) return
    setUploading(docType)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('deal_id', deal.id)
    fd.append('contact_id', contact.id)
    fd.append('doc_type', docType)
    if (docType === 'title_company_info' || docType === 'insurance_agent_info') {
      const info = contactInfo[docType] ?? {}
      fd.append('company_name', info.company_name ?? '')
      fd.append('contact_name', info.contact_name ?? '')
      fd.append('contact_phone', info.contact_phone ?? '')
      fd.append('contact_email', info.contact_email ?? '')
    }
    const res = await fetch('/api/portal/documents/upload', { method: 'POST', body: fd })
    setUploading(null)
    if (res.ok) { toast.success('Document uploaded! We\'ll review it shortly.'); router.refresh() }
    else toast.error('Upload failed — please try again')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-dark-900 border-b border-dark-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gold-500 text-dark-800 font-black text-sm px-2 py-1 rounded-lg">AL</div>
            <div>
              <p className="text-white font-bold text-sm">Asset Lift Lending</p>
              <p className="text-gray-400 text-xs">Borrower Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-300 text-sm">{fmt.name(contact.first_name, contact.last_name)}</span>
            <button onClick={signOut} className="text-gray-400 hover:text-white flex items-center gap-1.5 text-xs">
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-black text-dark-800">
            Welcome back, {contact.first_name}! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">Track your loan application and upload required documents below.</p>
        </div>

        {/* Deal Selector */}
        {deals.length > 1 && (
          <div className="flex gap-2">
            {deals.map((d: any, i: number) => (
              <button key={d.id} onClick={() => setSelectedDeal(i)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-base
                  ${selectedDeal === i ? 'bg-gold-500 border-gold-500 text-dark-800' : 'bg-white border-gray-200 text-gray-600 hover:border-gold-300'}`}>
                Deal {i + 1}: {fmt.loanProgram(d.loan_program)}
              </button>
            ))}
          </div>
        )}

        {deal ? (
          <>
            {/* Status Timeline */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-bold text-dark-800 mb-5">Loan Status</h2>
              <div className="flex items-center">
                {STAGE_STEPS.map((step, i) => {
                  const done    = i < activeStepIdx
                  const current = i === activeStepIdx
                  return (
                    <div key={step.key} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                          ${done    ? 'bg-green-500 border-green-500 text-white' :
                            current ? 'bg-gold-500 border-gold-500 text-dark-800 ring-4 ring-gold-100' :
                            'bg-white border-gray-200 text-gray-300'}`}>
                          {done ? <CheckCircle size={14} /> : i + 1}
                        </div>
                        <p className={`text-xs mt-1.5 font-medium text-center max-w-[70px] leading-tight
                          ${done ? 'text-green-600' : current ? 'text-gold-700' : 'text-gray-400'}`}>
                          {step.label}
                        </p>
                      </div>
                      {i < STAGE_STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-1 mb-5 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Deal details */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-gray-100">
                {[
                  ['Loan Program',  fmt.loanProgram(deal.loan_program)],
                  ['Loan Amount',   deal.loan_amount ? fmt.currency(deal.loan_amount) : 'TBD'],
                  ['Property',      deal.property_address ?? 'TBD'],
                  ['Purchase Price',deal.purchase_price ? fmt.currency(deal.purchase_price) : 'TBD'],
                  ['Rehab Budget',  deal.rehab_amount ? fmt.currency(deal.rehab_amount) : 'TBD'],
                  ['ARV',           deal.after_repair_value ? fmt.currency(deal.after_repair_value) : 'TBD'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-gray-400 mb-0.5">{k}</p>
                    <p className="text-sm font-bold text-dark-800">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Loan Terms / Term Sheet — shown when admin has set terms */}
            {(deal.rate || deal.term_sheet_url) && (
              <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-6">
                <h2 className="font-bold text-dark-800 mb-4 flex items-center gap-2">
                  <FileText size={16} className="text-green-500" /> Your Loan Terms
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: 'Interest Rate', value: deal.rate ? `${deal.rate}%` : null },
                    { label: 'Points', value: deal.points ? String(deal.points) : null },
                    { label: 'LTV', value: deal.ltv ? `${deal.ltv}%` : null },
                    { label: 'Term', value: deal.term_months ? `${deal.term_months} months` : null },
                  ].filter(f => f.value).map(({ label, value }) => (
                    <div key={label} className="text-center bg-green-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 mb-1">{label}</p>
                      <p className="font-bold text-dark-800">{value}</p>
                    </div>
                  ))}
                </div>
                {deal.term_sheet_url && (
                  <a href={deal.term_sheet_url} target="_blank"
                    className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-800 font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
                    <FileText size={15} /> Download Term Sheet
                  </a>
                )}
              </div>
            )}

            {/* Document Checklist */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-dark-800 flex items-center gap-2">
                      <FileText size={16} className="text-gold-500" /> Required Documents
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">{approvedCount} of {DOC_TYPES.length} approved</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-dark-800">{Math.round((approvedCount / DOC_TYPES.length) * 100)}%</div>
                    <div className="text-xs text-gray-400">complete</div>
                  </div>
                </div>
                <div className="mt-3 bg-gray-100 rounded-full h-2">
                  <div className="bg-gold-500 rounded-full h-2 transition-all" style={{ width: `${(approvedCount / DOC_TYPES.length) * 100}%` }} />
                </div>
              </div>

              <div className="divide-y divide-gray-50">
                {DOC_TYPES.map(dt => {
                  const doc      = docMap[dt.key]
                  const approved = doc?.status === 'approved'
                  const pending  = doc?.status === 'pending'
                  const needsContactInfo = dt.key === 'title_company_info' || dt.key === 'insurance_agent_info'
                  const info = contactInfo[dt.key] ?? {}

                  return (
                    <div key={dt.key} className="flex items-start gap-4 p-4">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                        ${approved ? 'bg-green-100 text-green-600' : pending ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-300'}`}>
                        {approved ? <CheckCircle size={14} /> : pending ? <Clock size={14} /> : <Circle size={14} />}
                      </div>

                      <div className="flex-1">
                        <p className={`text-sm font-medium ${approved ? 'text-gray-400 line-through' : 'text-dark-800'}`}>{dt.label}</p>
                        {doc?.file_name && <p className="text-xs text-gray-400">{doc.file_name}</p>}
                        {needsContactInfo && !approved && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              value={info.company_name ?? ''}
                              onChange={(event) => setInfo(dt.key, 'company_name', event.target.value)}
                              placeholder={dt.key === 'title_company_info' ? 'Title company name' : 'Insurance company name'}
                              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                            />
                            <input
                              value={info.contact_name ?? ''}
                              onChange={(event) => setInfo(dt.key, 'contact_name', event.target.value)}
                              placeholder="Contact name"
                              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                            />
                            <input
                              value={info.contact_phone ?? ''}
                              onChange={(event) => setInfo(dt.key, 'contact_phone', event.target.value)}
                              placeholder="Phone number"
                              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                            />
                            <input
                              type="email"
                              value={info.contact_email ?? ''}
                              onChange={(event) => setInfo(dt.key, 'contact_email', event.target.value)}
                              placeholder="Email"
                              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                            />
                          </div>
                        )}
                      </div>

                      {approved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✓ Approved</span>}
                      {pending  && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">⏳ Under Review</span>}

                      {!approved && (
                        <label className={`flex items-center gap-1.5 text-xs font-medium cursor-pointer px-3 py-1.5 rounded-xl border transition-base
                          ${uploading === dt.key ? 'opacity-50 pointer-events-none border-gray-200 text-gray-400' :
                            pending ? 'border-yellow-200 text-yellow-700 hover:border-yellow-400' :
                            'border-gold-300 text-gold-700 hover:bg-gold-50'}`}>
                          <Upload size={12} />
                          {uploading === dt.key ? 'Uploading...' : doc ? (needsContactInfo ? 'Re-upload Quote' : 'Re-upload') : (needsContactInfo ? 'Upload Quote' : 'Upload')}
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) uploadDoc(dt.key, file)
                          }} />
                        </label>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Appraisal Payment */}
            {!deal.appraisal_paid && (
              <div className="bg-white rounded-2xl border border-gold-200 shadow-sm p-5">
                <h2 className="font-bold text-dark-800 mb-2 flex items-center gap-2">
                  <CreditCard size={16} className="text-gold-500" /> Appraisal Fee Required
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  A property appraisal fee of <strong>$550 – $850</strong> is required to proceed with your loan.
                  Your loan officer will send you a secure payment link.
                </p>
                <div className="bg-gold-50 border border-gold-200 rounded-xl p-3 text-xs text-gold-800">
                  📧 Your loan officer will email you a secure Stripe payment link shortly.
                  Please check your email and complete the payment to move forward.
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <Home size={32} className="mx-auto text-gray-300 mb-3" />
            <h2 className="text-lg font-bold text-dark-800 mb-2">No Active Application</h2>
            <p className="text-gray-500 text-sm">
              Your loan application hasn't been created yet. Please contact your loan officer to get started.
            </p>
            <div className="flex gap-3 justify-center mt-4">
              <a href="tel:+1" className="flex items-center gap-1.5 text-sm text-gold-600 font-medium hover:text-gold-700">
                <Phone size={14} /> Call Us
              </a>
              <a href="mailto:info@assetliftlending.com" className="flex items-center gap-1.5 text-sm text-gold-600 font-medium hover:text-gold-700">
                <Mail size={14} /> Email Us
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

