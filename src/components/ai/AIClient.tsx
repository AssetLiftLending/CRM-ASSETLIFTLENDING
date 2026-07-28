'use client'

import { useState } from 'react'
import { Sparkles, Megaphone, MessageSquare, BarChart2, Send, Copy, Check, Loader2 } from 'lucide-react'
import { fmt } from '@/lib/utils/format'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

type Tab = 'followup' | 'ads' | 'draft' | 'insights'

interface Contact {
  id: string; first_name: string; last_name: string; phone?: string; email?: string
  deals?: Array<{ id: string; stage: string; loan_program: string; loan_amount?: number; updated_at: string }>
}

interface AdVariation {
  primary_text: string
  headline: string
  description: string
  cta: string
  targeting: string
  predicted_strength: number
}

interface AdResult {
  variations?: AdVariation[]
}

export default function AIClient({
  contacts, adDrafts, defaultTab
}: {
  contacts: Contact[]
  adDrafts: Array<{
    id: string; platform: string; status: string; variations: unknown
    campaign_goal?: string; created_at: string
  }>
  defaultTab: string
}) {
  const router = useRouter()
  const [tab, setTab]           = useState<Tab>((defaultTab as Tab) || 'followup')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<unknown>(null)
  const [copied, setCopied]     = useState<string | null>(null)

  // Follow-up coach state
  const [priorityList, setPriorityList] = useState<unknown[]>([])
  const [scoringLoading, setScoringLoading] = useState(false)

  // Ad creator state
  const [adPlatform, setAdPlatform] = useState<'meta' | 'google'>('meta')
  const [adProgram, setAdProgram]   = useState('fix_flip')
  const [adAudience, setAdAudience] = useState('')
  const [adGoal, setAdGoal]         = useState('')
  const [adGeo, setAdGeo]           = useState('New Jersey, New York')
  const [adResult, setAdResult]     = useState<AdResult | null>(null)
  const [adLoading, setAdLoading]   = useState(false)

  // Draft message state
  const [draftContact, setDraftContact] = useState('')
  const [draftMedium, setDraftMedium]   = useState<'sms' | 'email' | 'whatsapp'>('sms')
  const [draftResult, setDraftResult]   = useState<unknown>(null)
  const [draftLoading, setDraftLoading] = useState(false)

  async function loadPriorityList() {
    setScoringLoading(true)
    const leadsForScoring = contacts.slice(0, 20).map((c) => {
      const deal = c.deals?.[0]
      const lastContact = deal?.updated_at ?? c.deals?.[0]?.updated_at ?? ''
      const daysSince = lastContact
        ? Math.floor((Date.now() - new Date(lastContact).getTime()) / 86400000)
        : 30
      return {
        id: c.id,
        name: fmt.name(c.first_name, c.last_name),
        stage: deal?.stage ?? 'new_inquiry',
        loan_program: deal?.loan_program ?? 'fix_flip',
        last_contact_days: daysSince,
        email_opens: 0,
        sms_replies: 0,
        deal_value: deal?.loan_amount ?? 0,
        documents_submitted: 0,
      }
    })

    const res = await fetch('/api/ai/priority-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads: leadsForScoring }),
    })

    if (res.ok) {
      const data = await res.json()
      setPriorityList(data.scored ?? [])
    } else {
      toast.error('AI scoring failed')
    }
    setScoringLoading(false)
  }

  async function generateAd() {
    if (!adAudience.trim()) return toast.error('Describe your target audience')
    setAdLoading(true)
    const res = await fetch('/api/ai/generate-ad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: adPlatform,
        loanProgram: adProgram,
        targetAudience: adAudience,
        goal: adGoal || 'Lead generation — fix and flip investors',
        geography: adGeo,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setAdResult(data)
    } else {
      toast.error('Ad generation failed')
    }
    setAdLoading(false)
  }

  async function approveAd(adData: unknown) {
    const res = await fetch('/api/ai/approve-ad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: adData, platform: adPlatform }),
    })
    if (res.ok) toast.success('Ad saved — submit to Meta/Google from your Ads Manager')
    else toast.error('Failed to save ad')
  }

  async function generateDraft() {
    const contact = contacts.find((c) => c.id === draftContact)
    if (!contact) return toast.error('Select a contact')
    setDraftLoading(true)
    const deal = contact.deals?.[0]
    const res = await fetch('/api/ai/draft-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: fmt.name(contact.first_name, contact.last_name),
        loanProgram: deal?.loan_program ?? 'fix_flip',
        stage: deal?.stage ?? 'new_inquiry',
        lastContactDate: deal?.updated_at ?? '',
        medium: draftMedium,
      }),
    })
    if (res.ok) { const d = await res.json(); setDraftResult(d.variations ?? []) }
    else toast.error('Draft failed')
    setDraftLoading(false)
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
    toast.success('Copied!')
  }

  const LOAN_PROGRAMS = [
    { value: 'fix_flip', label: 'Fix & Flip' }, { value: 'dscr', label: 'DSCR' },
    { value: 'ground_up', label: 'Ground-Up' }, { value: 'commercial', label: 'Commercial' },
    { value: 'multifamily', label: 'Multifamily' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-dark-800 flex items-center gap-2">
          <Sparkles className="text-gold-500" size={24} /> AI Tools
        </h1>
        <p className="text-gray-500 text-sm">Powered by GPT-4o + Claude — built for private lending</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1.5 shadow-sm">
        {([
          { key: 'followup', label: '🎯 Follow-Up Coach', icon: BarChart2 },
          { key: 'ads',      label: '📢 Ad Creator',      icon: Megaphone },
          { key: 'draft',    label: '✍️ Draft Message',   icon: MessageSquare },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-base
              ${tab === t.key ? 'bg-gold-500 text-dark-800' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── FOLLOW-UP COACH ── */}
      {tab === 'followup' && (
        <div className="space-y-4">
          <div className="bg-dark-800 rounded-2xl p-6 text-white">
            <h2 className="text-lg font-bold text-gold-400 mb-2">🎯 Smart Follow-Up Priority</h2>
            <p className="text-gray-400 text-sm mb-5">Claude analyzes every lead — days since contact, deal size, engagement, stage — and tells you exactly who to call today and what to say.</p>
            <button
              onClick={loadPriorityList}
              disabled={scoringLoading}
              className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800 font-bold px-6 py-3 rounded-xl text-sm transition-base"
            >
              {scoringLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {scoringLoading ? 'Scoring your leads…' : 'Score My Leads Now'}
            </button>
          </div>

          {priorityList.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold text-dark-800">Today&apos;s Priority List</h3>
              {(priorityList as Array<{
                id: string; score: number; reason: string
                suggested_action: string; suggested_medium: string
              }>).map((item, i) => {
                const contact = contacts.find((c) => c.id === item.id)
                if (!contact) return null
                return (
                  <div key={item.id}
                    className={`bg-white rounded-2xl border p-5 shadow-sm flex items-start gap-4
                      ${i === 0 ? 'border-gold-300' : 'border-gray-100'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm
                      ${i === 0 ? 'bg-gold-500 text-dark-800' : 'bg-gray-100 text-gray-600'}`}>
                      #{i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-bold text-dark-800">{fmt.name(contact.first_name, contact.last_name)}</span>
                        <span className="text-xs font-bold text-gold-600">Score: {item.score}/10</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{item.reason}</p>
                      <div className="bg-gold-50 border border-gold-200 rounded-xl p-2.5 text-xs text-gold-800">
                        <strong>Suggested:</strong> {item.suggested_action}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {contact.phone && (
                        <a href={`/communications?tab=${item.suggested_medium}&contact=${contact.id}`}
                          className="bg-gold-500 text-dark-800 font-bold text-xs px-3 py-2 rounded-xl hover:bg-gold-400 transition-base capitalize">
                          {item.suggested_medium === 'call' ? '📞' : item.suggested_medium === 'sms' ? '💬' : '📧'} {item.suggested_medium}
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── AD CREATOR ── */}
      {tab === 'ads' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <h2 className="font-bold text-dark-800 text-lg">📢 AI Ad Creator</h2>
            <p className="text-sm text-gray-500">
              GPT-4o writes high-converting Meta and Google ads using top-performing hooks in the private lending space.
              <strong className="text-dark-800"> You review and approve before anything goes live.</strong>
            </p>

            {/* Platform */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Platform</label>
              <div className="flex gap-3">
                {(['meta', 'google'] as const).map((p) => (
                  <button key={p}
                    onClick={() => setAdPlatform(p)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-base capitalize
                      ${adPlatform === p ? 'bg-dark-800 text-gold-400 border-dark-800' : 'bg-white text-gray-500 border-gray-200 hover:border-dark-400'}`}>
                    {p === 'meta' ? '📘 Meta / Facebook' : '🔍 Google Ads'}
                  </button>
                ))}
              </div>
            </div>

            {/* Loan Program */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Loan Program</label>
              <div className="flex flex-wrap gap-2">
                {LOAN_PROGRAMS.map((p) => (
                  <button key={p.value}
                    onClick={() => setAdProgram(p.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-base
                      ${adProgram === p.value ? 'bg-gold-500 border-gold-500 text-dark-800' : 'bg-white border-gray-200 text-gray-600 hover:border-gold-300'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Audience */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Target Audience *</label>
                <textarea
                  value={adAudience}
                  onChange={(e) => setAdAudience(e.target.value)}
                  placeholder="e.g. Fix & flip investors in NJ/NY with 2+ prior deals, looking for $150k-$500k bridge loans"
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold-500 resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Geography</label>
                <input value={adGeo} onChange={(e) => setAdGeo(e.target.value)}
                  placeholder="New Jersey, New York, PA"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold-500 mb-2" />
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block mt-2">Campaign Goal</label>
                <input value={adGoal} onChange={(e) => setAdGoal(e.target.value)}
                  placeholder="Lead generation, brand awareness, etc."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold-500" />
              </div>
            </div>

            <button
              onClick={generateAd}
              disabled={adLoading || !adAudience.trim()}
              className="w-full flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800 font-bold py-3.5 rounded-xl text-sm transition-base"
            >
              {adLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {adLoading ? 'Generating ads…' : `Generate ${adPlatform === 'meta' ? 'Meta' : 'Google'} Ad Variations`}
            </button>
          </div>

          {/* Ad Results */}
          {adResult && (
            <div className="bg-white rounded-2xl border border-gold-300 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-dark-800">
                  ✨ Generated Ad Variations — Review &amp; Approve
                </h3>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-bold">
                  Pending Your Approval
                </span>
              </div>

              {adPlatform === 'meta' && Array.isArray(adResult.variations) && (
                <div className="space-y-4">
                  {(adResult.variations ?? []).map((v, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-500">VARIATION {i + 1}</span>
                        <span className="text-xs bg-gold-100 text-gold-700 px-2 py-0.5 rounded-full font-bold">
                          Strength: {v.predicted_strength}/10
                        </span>
                      </div>
                      <CopyRow label="Primary Text" text={v.primary_text} id={`p-${i}`} copied={copied} onCopy={copyToClipboard} />
                      <CopyRow label="Headline" text={v.headline} id={`h-${i}`} copied={copied} onCopy={copyToClipboard} />
                      <CopyRow label="Description" text={v.description} id={`d-${i}`} copied={copied} onCopy={copyToClipboard} />
                      <div className="text-xs text-gray-500"><strong>CTA:</strong> {v.cta}</div>
                      <div className="text-xs text-gray-500"><strong>Targeting:</strong> {v.targeting}</div>
                      <button
                        onClick={() => approveAd(v)}
                        className="mt-2 w-full bg-green-500 hover:bg-green-400 text-white font-bold text-sm py-2 rounded-xl transition-base"
                      >
                        ✓ Approve &amp; Save This Variation
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── DRAFT MESSAGE ── */}
      {tab === 'draft' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-dark-800">✍️ Draft Follow-Up Message</h2>
            <p className="text-sm text-gray-500">Pick a contact and medium — AI writes 2 personalized message variations you can edit and send.</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Contact</label>
                <select value={draftContact} onChange={(e) => setDraftContact(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold-500">
                  <option value="">Select a contact…</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{fmt.name(c.first_name, c.last_name)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Medium</label>
                <div className="flex gap-2">
                  {(['sms', 'email', 'whatsapp'] as const).map((m) => (
                    <button key={m} onClick={() => setDraftMedium(m)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold capitalize border transition-base
                        ${draftMedium === m ? 'bg-gold-500 border-gold-500 text-dark-800' : 'bg-white border-gray-200 text-gray-600 hover:border-gold-300'}`}>
                      {m === 'sms' ? '💬 SMS' : m === 'email' ? '📧 Email' : '🟢 WA'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={generateDraft}
              disabled={draftLoading || !draftContact}
              className="w-full flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800 font-bold py-3 rounded-xl text-sm transition-base"
            >
              {draftLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {draftLoading ? 'Writing…' : 'Generate Message Drafts'}
            </button>
          </div>

          {Array.isArray(draftResult) && draftResult.length > 0 && (
            <div className="space-y-3">
              {(draftResult as Array<{ subject?: string; body: string; tone: string }>).map((v, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-500 uppercase">Variation {i + 1} · {v.tone}</span>
                    <button
                      onClick={() => copyToClipboard(v.body, `draft-${i}`)}
                      className="flex items-center gap-1 text-xs text-gold-600 hover:underline"
                    >
                      {copied === `draft-${i}` ? <Check size={12} /> : <Copy size={12} />}
                      {copied === `draft-${i}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  {v.subject && <div className="text-sm font-semibold text-dark-800 mb-2">Subject: {v.subject}</div>}
                  <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap">{v.body}</div>
                  <div className="flex gap-2 mt-3">
                    <a href={`/communications?tab=${draftMedium}&contact=${draftContact}`}
                      className="flex items-center gap-1 text-xs bg-gold-500 text-dark-800 font-bold px-3 py-2 rounded-xl hover:bg-gold-400 transition-base">
                      <Send size={12} /> Send This
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CopyRow({ label, text, id, copied, onCopy }: {
  label: string; text: string; id: string
  copied: string | null; onCopy: (t: string, id: string) => void
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{label}:</span>
      <span className="text-sm text-dark-800 flex-1">{text}</span>
      <button onClick={() => onCopy(text, id)}
        className="text-gray-400 hover:text-gold-500 transition-base flex-shrink-0">
        {copied === id ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
      </button>
    </div>
  )
}
