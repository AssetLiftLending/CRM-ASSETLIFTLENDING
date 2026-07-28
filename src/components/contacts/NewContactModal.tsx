'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const LOAN_PROGRAMS = [
  { value: 'fix_flip', label: 'Fix & Flip' },
  { value: 'dscr', label: 'DSCR' },
  { value: 'ground_up', label: 'Ground-Up Construction' },
  { value: 'commercial', label: 'Commercial Bridge' },
  { value: 'multifamily', label: 'Multifamily' },
  { value: 'custom', label: 'Custom / Other' },
]

const LEAD_SOURCES = [
  { value: 'meta_ad', label: 'Meta Ad' },
  { value: 'google_ad', label: 'Google Ad' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'referral', label: 'Referral' },
  { value: 'email', label: 'Email Campaign' },
  { value: 'direct', label: 'Direct / Manual' },
  { value: 'zillow', label: 'Zillow' },
  { value: 'other', label: 'Other' },
]

export default function NewContactModal({
  onClose,
  profiles,
}: {
  onClose: () => void
  profiles: Array<{ id: string; full_name: string | null }>
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', cell_phone: '', whatsapp: '',
    address: '', city: '', state: '', zip: '',
    lead_source: 'direct', assigned_to: '',
    // Deal
    create_deal: true,
    loan_program: 'fix_flip',
    property_address: '', purchase_price: '', rehab_amount: '', loan_amount: '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to create contact')
      const data = await res.json()
      toast.success('Contact created!')
      onClose()
      router.push(`/contacts/${data.id}`)
      router.refresh()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-dark-800">New Lead / Contact</h2>
            <p className="text-sm text-gray-500 mt-0.5">A deal will be created automatically</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Contact Info */}
          <div>
            <h3 className="text-sm font-bold text-dark-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-gold-500 text-dark-800 rounded-full flex items-center justify-center text-xs font-black">1</span>
              Contact Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name *" value={form.first_name} onChange={set('first_name')} required />
              <Field label="Last Name *" value={form.last_name} onChange={set('last_name')} required />
              <Field label="Phone" value={form.phone} onChange={set('phone')} type="tel" />
              <Field label="Email" value={form.email} onChange={set('email')} type="email" />
              <Field label="Cell Phone" value={form.cell_phone} onChange={set('cell_phone')} type="tel" />
              <Field label="WhatsApp Number" value={form.whatsapp} onChange={set('whatsapp')} type="tel" />
            </div>
          </div>

          {/* Lead Source */}
          <div>
            <h3 className="text-sm font-bold text-dark-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-gold-500 text-dark-800 rounded-full flex items-center justify-center text-xs font-black">2</span>
              Lead Source & Assignment
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Lead Source</label>
                <select value={form.lead_source} onChange={set('lead_source')}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold-500">
                  {LEAD_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Assign To</label>
                <select value={form.assigned_to} onChange={set('assigned_to')}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold-500">
                  <option value="">Unassigned</option>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Deal */}
          <div>
            <h3 className="text-sm font-bold text-dark-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-gold-500 text-dark-800 rounded-full flex items-center justify-center text-xs font-black">3</span>
              Deal Details (optional — can add later)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Loan Program</label>
                <div className="flex flex-wrap gap-2">
                  {LOAN_PROGRAMS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, loan_program: p.value }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-base
                        ${form.loan_program === p.value
                          ? 'bg-gold-500 border-gold-500 text-dark-800'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gold-300'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Property Address" value={form.property_address} onChange={set('property_address')} />
              <Field label="Purchase Price" value={form.purchase_price} onChange={set('purchase_price')} type="number" placeholder="$0" />
              <Field label="Rehab Amount" value={form.rehab_amount} onChange={set('rehab_amount')} type="number" placeholder="$0" />
              <Field label="Loan Amount Requested" value={form.loan_amount} onChange={set('loan_amount')} type="number" placeholder="$0" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-base">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-gold-500 hover:bg-gold-400 text-dark-800 font-bold py-2.5 rounded-xl text-sm transition-base disabled:opacity-50">
              {loading ? 'Creating…' : 'Create Lead →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', required, placeholder
}: {
  label: string; value: string; onChange: React.ChangeEventHandler<HTMLInputElement>
  type?: string; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                   focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-base"
      />
    </div>
  )
}
