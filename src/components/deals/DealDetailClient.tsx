'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, CheckCircle, Circle, Upload,
  DollarSign, FileText, Clock, AlertCircle, CreditCard, User
} from 'lucide-react'
import toast from 'react-hot-toast'
import { fmt, STAGE_COLORS } from '@/lib/utils/format'

type Deal = Record<string, any>
type Doc  = Record<string, any>
type Task = Record<string, any>

interface Props { deal: Deal; docs: Doc[]; tasks: Task[] }

const STAGES = ['new_inquiry','contacted','just_searching','dead_lead','in_progress','funded'] as const

const LOAN_PROGRAMS = [
  { key: 'fix_flip',    label: 'Fix & Flip' },
  { key: 'dscr',       label: 'DSCR' },
  { key: 'ground_up',  label: 'Ground-Up' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'multifamily',label: 'Multifamily' },
] as const

const DOC_TYPES = [
  { key: 'government_id',          label: 'Government-Issued ID' },
  { key: 'ssn',                    label: 'Social Security Number' },
  { key: 'bank_statement',         label: 'Recent Bank Statement' },
  { key: 'purchase_contract',      label: 'Signed Purchase Contract' },
  { key: 'llc_documents',          label: 'LLC Documents' },
  { key: 'scope_of_work',          label: 'Scope of Work' },
  { key: 'reo_experience',         label: 'REO Experience Form' },
  { key: 'title_company_info',     label: 'Title Company Contact' },
  { key: 'insurance_agent_info',   label: 'Insurance Agent Contact' },
  { key: 'appraisal_payment',      label: 'Appraisal Payment' },
] as const

export default function DealDetailClient({ deal, docs, tasks }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    stage:          deal.stage ?? 'new_inquiry',
    loan_program:   deal.loan_program ?? 'fix_flip',
    loan_amount:    deal.loan_amount ?? '',
    purchase_price: deal.purchase_price ?? '',
    rehab_amount:   deal.rehab_amount  ?? '',
    property_address: deal.property_address ?? '',
    after_repair_value: deal.after_repair_value ?? '',
    credit_score:   deal.credit_score ?? '',
    experience:     deal.experience_level ?? '',
    under_contract: Boolean(deal.under_contract),
    occupancy:      deal.occupancy ?? '',
    exit_strategy:  deal.exit_strategy ?? '',
    close_date_target: deal.close_date_target ?? '',
    title_company:  deal.title_company_contact ?? '',
    insurance_agent: deal.insurance_agent_contact ?? '',
    notes:          deal.notes ?? '',
  })
  const [uploading, setUploading] = useState<string | null>(null)
  const [appraisalAmount, setAppraisalAmount] = useState(650)
  const [paymentLoading, setPaymentLoading] = useState(false)

  const contact = deal.contacts as any
  const name = contact ? fmt.name(contact.first_name, contact.last_name) : 'Unknown'

  async function saveDeal() {
    setSaving(true)
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage:          form.stage,
        loan_program:   form.loan_program,
        loan_amount:    form.loan_amount ? Number(form.loan_amount) : null,
        purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
        rehab_amount:   form.rehab_amount  ? Number(form.rehab_amount)  : null,
        property_address: form.property_address || null,
        after_repair_value: form.after_repair_value ? Number(form.after_repair_value) : null,
        credit_score:   form.credit_score ? Number(form.credit_score) : null,
        experience_level: form.experience || null,
        experience: form.experience || null,
        under_contract: form.under_contract,
        occupancy: form.occupancy || null,
        exit_strategy: form.exit_strategy || null,
        close_date_target: form.close_date_target || null,
        title_company_contact: form.title_company || null,
        insurance_agent_contact: form.insurance_agent || null,
        notes: form.notes || null,
      }),
    })
    setSaving(false)
    if (res.ok) { toast.success('Deal updated'); router.refresh() }
    else toast.error('Save failed')
  }

  async function uploadDoc(docType: string, file: File) {
    setUploading(docType)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('deal_id', deal.id)
    fd.append('contact_id', deal.contact_id)
    fd.append('doc_type', docType)
    const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
    setUploading(null)
    if (res.ok) { toast.success('Document uploaded'); router.refresh() }
    else toast.error('Upload failed')
  }

  async function initiateAppraisalPayment() {
    setPaymentLoading(true)
    const res = await fetch('/api/payments/appraisal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_id: deal.id, contact_id: deal.contact_id, amount: appraisalAmount }),
    })
    const data = await res.json()
    setPaymentLoading(false)
    if (data.url) {
      window.open(data.url, '_blank')
    } else if (data.payment_link) {
      await navigator.clipboard.writeText(data.payment_link)
      toast.success('Payment link copied to clipboard!')
    } else {
      toast.error('Payment setup failed')
    }
  }

  const docMap = Object.fromEntries(docs.map(d => [d.doc_type, d]))
  const stageIdx = STAGES.indexOf(form.stage as typeof STAGES[number])

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href={`/contacts/${deal.contact_id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gold-600 transition-colors">
          <ChevronLeft size={16} /> {name}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-500">Deal</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-xl font-black text-dark-800">{fmt.loanProgram(form.loan_program)} — {name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {form.property_address || 'No property address yet'} &nbsp;·&nbsp; Created {fmt.date(deal.created_at)}
            </p>
          </div>
          <span className={`text-sm px-3 py-1 rounded-full font-bold ${STAGE_COLORS[form.stage] ?? 'bg-gray-100 text-gray-600'}`}>
            {fmt.stage(form.stage)}
          </span>
        </div>

        {/* Stage Pipeline */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto">
          {STAGES.map((s, i) => (
            <button key={s} onClick={() => setForm(p => ({ ...p, stage: s }))}
              className={`flex-1 min-w-[80px] py-2 px-2 rounded-xl text-xs font-bold text-center transition-base border
                ${form.stage === s ? 'bg-gold-500 border-gold-500 text-dark-800' :
                  i < stageIdx ? 'bg-green-50 border-green-200 text-green-700' :
                  'bg-gray-50 border-gray-200 text-gray-500 hover:border-gold-300'}`}>
              {fmt.stage(s)}
            </button>
          ))}
        </div>

        {/* Deal Fields */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {/* Loan Program */}
          <div className="col-span-3">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Loan Program</label>
            <div className="flex gap-2 flex-wrap">
              {LOAN_PROGRAMS.map(lp => (
                <button key={lp.key} onClick={() => setForm(p => ({ ...p, loan_program: lp.key }))}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-base
                    ${form.loan_program === lp.key ? 'bg-gold-500 border-gold-500 text-dark-800' : 'bg-white border-gray-200 text-gray-600 hover:border-gold-300'}`}>
                  {lp.label}
                </button>
              ))}
            </div>
          </div>

          {[
            { key: 'loan_amount',        label: 'Loan Amount',        prefix: '$' },
            { key: 'purchase_price',     label: 'Purchase Price',     prefix: '$' },
            { key: 'rehab_amount',       label: 'Rehab Budget',       prefix: '$' },
            { key: 'after_repair_value', label: 'After Repair Value', prefix: '$' },
            { key: 'credit_score',       label: 'Credit Score',       prefix: '' },
            { key: 'experience',         label: 'Experience Level',   prefix: '' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">{f.label}</label>
              <div className="relative">
                {f.prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{f.prefix}</span>}
                <input
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className={`w-full border border-gray-200 rounded-xl py-2 text-sm focus:outline-none focus:border-gold-500 ${f.prefix ? 'pl-7 pr-3' : 'px-3'}`}
                  placeholder="—"
                />
              </div>
            </div>
          ))}

          <div className="col-span-3">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Property Address</label>
            <input value={form.property_address} onChange={e => setForm(p => ({ ...p, property_address: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
              placeholder="123 Main St, City, State 00000" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Target Close Date</label>
            <input type="date" value={form.close_date_target} onChange={e => setForm(p => ({ ...p, close_date_target: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Occupancy</label>
            <select value={form.occupancy} onChange={e => setForm(p => ({ ...p, occupancy: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500">
              <option value="">Select occupancy</option>
              <option value="vacant">Vacant</option>
              <option value="tenant_occupied">Tenant occupied</option>
              <option value="owner_occupied">Owner occupied</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Exit Strategy</label>
            <select value={form.exit_strategy} onChange={e => setForm(p => ({ ...p, exit_strategy: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500">
              <option value="">Select exit</option>
              <option value="sell">Sell</option>
              <option value="refinance">Refinance</option>
              <option value="rent_hold">Rent and hold</option>
              <option value="construction_sale">Construction sale</option>
            </select>
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.under_contract}
              onChange={e => setForm(p => ({ ...p, under_contract: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-gold-500 focus:ring-gold-500" />
            Under contract
          </label>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Title Company Contact</label>
            <input value={form.title_company} onChange={e => setForm(p => ({ ...p, title_company: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
              placeholder="Name, phone, email" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Insurance Agent Contact</label>
            <input value={form.insurance_agent} onChange={e => setForm(p => ({ ...p, insurance_agent: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
              placeholder="Name, phone, email" />
          </div>

          <div className="col-span-3">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500 resize-none"
              placeholder="Deal notes…" />
          </div>
        </div>

        <button onClick={saveDeal} disabled={saving}
          className="bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800 font-bold px-6 py-2.5 rounded-xl text-sm">
          {saving ? 'Saving…' : 'Save Deal'}
        </button>
      </div>

      {/* Document Checklist */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-bold text-dark-800 flex items-center gap-2">
            <FileText size={16} className="text-gold-500" /> Document Checklist
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {docs.filter(d => d.status === 'approved').length} / {DOC_TYPES.length} documents approved
          </p>
          {/* Progress bar */}
          <div className="mt-3 bg-gray-100 rounded-full h-2">
            <div
              className="bg-gold-500 rounded-full h-2 transition-all"
              style={{ width: `${(docs.filter(d => d.status === 'approved').length / DOC_TYPES.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {DOC_TYPES.map(dt => {
            const doc = docMap[dt.key]
            const approved = doc?.status === 'approved'
            const pending  = doc?.status === 'pending'

            return (
              <div key={dt.key} className="flex items-center gap-4 p-4">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                  ${approved ? 'bg-green-100 text-green-600' : pending ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-300'}`}>
                  {approved ? <CheckCircle size={14} /> : pending ? <Clock size={14} /> : <Circle size={14} />}
                </div>

                <div className="flex-1">
                  <p className={`text-sm font-medium ${approved ? 'text-green-700' : 'text-dark-800'}`}>{dt.label}</p>
                  {doc?.file_name && <p className="text-xs text-gray-400">{doc.file_name}</p>}
                  {doc?.notes && <p className="text-xs text-gray-400 italic">{doc.notes}</p>}
                </div>

                {approved && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Approved</span>
                )}
                {pending && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">Pending Review</span>
                )}

                {/* Upload button */}
                {!approved && (
                  <label className={`flex items-center gap-1.5 text-xs font-medium cursor-pointer px-3 py-1.5 rounded-xl border transition-base
                    ${uploading === dt.key ? 'opacity-50 pointer-events-none' : 'border-gray-200 text-gray-600 hover:border-gold-400 hover:text-gold-700'}`}>
                    <Upload size={12} />
                    {uploading === dt.key ? 'Uploading…' : doc ? 'Replace' : 'Upload'}
                    <input type="file" className="hidden" onChange={e => {
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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-dark-800 mb-4 flex items-center gap-2">
          <CreditCard size={16} className="text-gold-500" /> Appraisal Payment
        </h2>
        {deal.appraisal_paid ? (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
            <CheckCircle size={20} className="text-green-500" />
            <div>
              <p className="font-medium text-green-700">Appraisal payment received</p>
              <p className="text-xs text-gray-500">{deal.appraisal_paid_at ? fmt.dateTime(deal.appraisal_paid_at) : ''}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Collect the appraisal fee from the borrower via Stripe payment link.</p>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Amount:</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  value={appraisalAmount}
                  onChange={e => setAppraisalAmount(Number(e.target.value))}
                  className="w-28 border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                  min={550} max={850}
                />
              </div>
              <span className="text-xs text-gray-400">(typically $550 – $850)</span>
            </div>
            <button onClick={initiateAppraisalPayment} disabled={paymentLoading}
              className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800 font-bold px-5 py-2.5 rounded-xl text-sm">
              <DollarSign size={15} />
              {paymentLoading ? 'Creating link…' : 'Send Payment Link to Borrower'}
            </button>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <AlertCircle size={11} /> A Stripe checkout link will be generated and copied to your clipboard to send to the borrower.
            </p>
          </div>
        )}
      </div>

      {/* Term Sheet / Loan Terms */}
      <TermSheetPanel deal={deal} onSaved={() => router.refresh()} />

      {/* Tasks */}
      {tasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-bold text-dark-800 flex items-center gap-2"><Clock size={16} className="text-gold-500" /> Deal Tasks</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {tasks.map(t => (
              <div key={t.id} className={`flex items-center gap-3 p-4 ${t.status === 'completed' ? 'opacity-50' : ''}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                  ${t.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-300'}`}>
                  {t.status === 'completed' ? <CheckCircle size={12} /> : <Circle size={12} />}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${t.status === 'completed' ? 'line-through text-gray-400' : 'text-dark-800'}`}>{t.title}</p>
                  {t.due_date && <p className="text-xs text-gray-400">{fmt.date(t.due_date)}</p>}
                </div>
                <span className="text-xs text-gray-400">{(t.profiles as any)?.full_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Term Sheet Panel ──────────────────────────────────────────────────────────
function TermSheetPanel({ deal, onSaved }: { deal: Deal; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rate, setRate] = useState(deal.rate ?? '')
  const [points, setPoints] = useState(deal.points ?? '')
  const [ltv, setLtv] = useState(deal.ltv ?? '')
  const [termMonths, setTermMonths] = useState(deal.term_months ?? '')
  const [file, setFile] = useState<File | null>(null)

  const hasTerms = deal.rate || deal.term_sheet_url

  async function handleSave() {
    setSaving(true)
    const fd = new FormData()
    if (file) fd.append('file', file)
    if (rate) fd.append('rate', String(rate))
    if (points) fd.append('points', String(points))
    if (ltv) fd.append('ltv', String(ltv))
    if (termMonths) fd.append('term_months', String(termMonths))
    const res = await fetch(`/api/deals/${deal.id}/terms`, { method: 'POST', body: fd })
    setSaving(false)
    if (res.ok) { toast.success('Terms saved & borrower notified'); setOpen(false); onSaved() }
    else toast.error('Save failed')
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-dark-800 flex items-center gap-2">
          <FileText size={16} className="text-gold-500" /> Loan Terms & Term Sheet
        </h2>
        <button onClick={() => setOpen(o => !o)}
          className="text-xs font-medium text-gold-600 hover:text-gold-700 border border-gold-200 px-3 py-1.5 rounded-xl transition-colors">
          {open ? 'Cancel' : hasTerms ? 'Update Terms' : 'Set Terms'}
        </button>
      </div>

      {/* Current terms display */}
      {hasTerms && !open && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Rate', value: deal.rate ? `${deal.rate}%` : '—' },
            { label: 'Points', value: deal.points ? String(deal.points) : '—' },
            { label: 'LTV', value: deal.ltv ? `${deal.ltv}%` : '—' },
            { label: 'Term', value: deal.term_months ? `${deal.term_months} mo` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="text-center bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="font-bold text-dark-800">{value}</p>
            </div>
          ))}
          {deal.term_sheet_url && (
            <div className="col-span-2 sm:col-span-4 mt-2">
              <a href={deal.term_sheet_url} target="_blank"
                className="inline-flex items-center gap-2 text-sm text-gold-600 hover:text-gold-700 font-medium">
                <FileText size={14} /> Download Term Sheet
              </a>
            </div>
          )}
        </div>
      )}

      {!hasTerms && !open && (
        <p className="text-sm text-gray-400">No terms set yet. Click "Set Terms" to upload a term sheet and set loan terms — the borrower will be notified automatically.</p>
      )}

      {/* Edit form */}
      {open && (
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Interest Rate (%)', value: rate, set: setRate, placeholder: '12.5' },
              { label: 'Points', value: points, set: setPoints, placeholder: '2.5' },
              { label: 'LTV (%)', value: ltv, set: setLtv, placeholder: '75' },
              { label: 'Term (months)', value: termMonths, set: setTermMonths, placeholder: '12' },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input type="number" value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-400" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Term Sheet PDF (optional)</label>
            <label className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-3 cursor-pointer hover:border-gold-300 transition-colors">
              <Upload size={15} className="text-gray-400" />
              <span className="text-sm text-gray-500">{file ? file.name : 'Upload PDF / Word doc'}</span>
              <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800 font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
            <FileText size={15} />
            {saving ? 'Saving…' : 'Save Terms & Notify Borrower / Broker'}
          </button>
        </div>
      )}
    </div>
  )
}
