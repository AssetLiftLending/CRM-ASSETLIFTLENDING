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
  { value: 'direct', label: 'Direct / Manual' },
  { value: 'referral', label: 'Referral' },
  { value: 'broker', label: 'Broker' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'meta_ad', label: 'Meta Ad' },
  { value: 'google_ad', label: 'Google Ad' },
  { value: 'email', label: 'Email Campaign' },
  { value: 'zillow', label: 'Zillow' },
  { value: 'other', label: 'Other' },
]

const PROPERTY_TYPES = ['SFR', '2-4 Unit', 'Multifamily', 'Commercial', 'Mixed Use', 'Land']

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
    first_name: '', last_name: '', email: '', phone: '',
    entity_name: '', entity_type: '',
    address: '', city: '', state: '', zip: '',
    lead_source: 'direct', assigned_to: '',
    create_deal: true,
    loan_program: 'fix_flip',
    property_address: '', property_city: '', property_state: '', property_zip: '',
    property_type: 'SFR',
    loan_amount: '', purchase_price: '', rehab_amount: '', after_repair_value: '',
    credit_score: '', experience_level: '',
    under_contract: false,
    close_date_target: '', occupancy: '', exit_strategy: '',
    notes: '',
  })

  const set = (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }))

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => null)
        throw new Error(error?.error || 'Failed to create lead')
      }

      const data = await res.json()
      toast.success('Lead created')
      onClose()
      router.push(data.deal?.id ? `/deals/${data.deal.id}` : `/contacts/${data.id}`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-dark-800">New Lead</h2>
            <p className="text-sm text-gray-500 mt-0.5">Creates a contact, deal, and portal-ready file.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <Section number="1" title="Borrower">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name *" value={form.first_name} onChange={set('first_name')} required />
              <Field label="Last Name *" value={form.last_name} onChange={set('last_name')} required />
              <Field label="Phone Number *" value={form.phone} onChange={set('phone')} type="tel" required />
              <Field label="Email *" value={form.email} onChange={set('email')} type="email" required />
              <Field label="Entity / LLC Name" value={form.entity_name} onChange={set('entity_name')} />
              <Field label="Entity Type" value={form.entity_type} onChange={set('entity_type')} placeholder="LLC, Corp, Individual" />
            </div>
          </Section>

          <Section number="2" title="Lead Source & Assignment">
            <div className="grid grid-cols-2 gap-4">
              <Select label="Lead Source" value={form.lead_source} onChange={set('lead_source')} options={LEAD_SOURCES} />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Assign To</label>
                <select value={form.assigned_to} onChange={set('assigned_to')} className={selectClassName}>
                  <option value="">Unassigned</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          <Section number="3" title="Deal">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Loan Program</label>
                <div className="flex flex-wrap gap-2">
                  {LOAN_PROGRAMS.map((program) => (
                    <button
                      key={program.value}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, loan_program: program.value }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-base
                        ${form.loan_program === program.value
                          ? 'bg-gold-500 border-gold-500 text-dark-800'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gold-300'}`}
                    >
                      {program.label}
                    </button>
                  ))}
                </div>
              </div>

              <Field label="Property Address *" value={form.property_address} onChange={set('property_address')} required />
              <Field label="Loan Amount *" value={form.loan_amount} onChange={set('loan_amount')} type="number" placeholder="$0" required />
              <Field label="Property City" value={form.property_city} onChange={set('property_city')} />
              <Field label="Property State" value={form.property_state} onChange={set('property_state')} />
              <Field label="Property ZIP" value={form.property_zip} onChange={set('property_zip')} />
              <Select
                label="Property Type"
                value={form.property_type}
                onChange={set('property_type')}
                options={PROPERTY_TYPES.map((type) => ({ value: type, label: type }))}
              />
              <Field label="Purchase Price" value={form.purchase_price} onChange={set('purchase_price')} type="number" placeholder="$0" />
              <Field label="Rehab Amount" value={form.rehab_amount} onChange={set('rehab_amount')} type="number" placeholder="$0" />
              <Field label="ARV" value={form.after_repair_value} onChange={set('after_repair_value')} type="number" placeholder="$0" />
              <Field label="Credit Score" value={form.credit_score} onChange={set('credit_score')} type="number" placeholder="680" />
              <Select
                label="Experience"
                value={form.experience_level}
                onChange={set('experience_level')}
                options={[
                  { value: '', label: 'Select experience' },
                  { value: 'first_time', label: 'First-time investor' },
                  { value: '1-3', label: '1-3 completed deals' },
                  { value: '4-10', label: '4-10 completed deals' },
                  { value: '10+', label: '10+ completed deals' },
                ]}
              />
              <Field label="Target Close Date" value={form.close_date_target} onChange={set('close_date_target')} type="date" />
              <Select
                label="Occupancy"
                value={form.occupancy}
                onChange={set('occupancy')}
                options={[
                  { value: '', label: 'Select occupancy' },
                  { value: 'vacant', label: 'Vacant' },
                  { value: 'tenant_occupied', label: 'Tenant occupied' },
                  { value: 'owner_occupied', label: 'Owner occupied' },
                ]}
              />
              <Select
                label="Exit Strategy"
                value={form.exit_strategy}
                onChange={set('exit_strategy')}
                options={[
                  { value: '', label: 'Select exit' },
                  { value: 'sell', label: 'Sell' },
                  { value: 'refinance', label: 'Refinance' },
                  { value: 'rent_hold', label: 'Rent and hold' },
                  { value: 'construction_sale', label: 'Construction sale' },
                ]}
              />
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.under_contract}
                  onChange={(event) => setForm((current) => ({ ...current, under_contract: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-gold-500 focus:ring-gold-500"
                />
                Under contract
              </label>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={set('notes')}
                  rows={4}
                  placeholder="Deal story, timing, title status, insurance, seller terms, red flags, documents already collected..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-base"
                />
              </div>
            </div>
          </Section>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-base">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-gold-500 hover:bg-gold-400 text-dark-800 font-bold py-2.5 rounded-xl text-sm transition-base disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-dark-800 mb-4 flex items-center gap-2">
        <span className="w-6 h-6 bg-gold-500 text-dark-800 rounded-full flex items-center justify-center text-xs font-black">{number}</span>
        {title}
      </h3>
      {children}
    </div>
  )
}

const inputClassName = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-base'
const selectClassName = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold-500'

function Field({
  label, value, onChange, type = 'text', required, placeholder
}: {
  label: string; value: string; onChange: React.ChangeEventHandler<HTMLInputElement>
  type?: string; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={onChange} required={required} placeholder={placeholder} className={inputClassName} />
    </div>
  )
}

function Select({
  label, value, onChange, options
}: {
  label: string
  value: string
  onChange: React.ChangeEventHandler<HTMLSelectElement>
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <select value={value} onChange={onChange} className={selectClassName}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  )
}
