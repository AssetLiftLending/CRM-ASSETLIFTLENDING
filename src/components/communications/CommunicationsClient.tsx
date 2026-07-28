'use client'

import { useState } from 'react'
import { Phone, MessageSquare, Mail, Send, Play } from 'lucide-react'
import { fmt } from '@/lib/utils/format'
import toast from 'react-hot-toast'

type Tab = 'feed' | 'call' | 'sms' | 'email' | 'whatsapp'

interface Contact { id: string; first_name: string; last_name: string; phone?: string; email?: string; whatsapp?: string }
interface Comm {
  id: string; type: string; direction?: string; body?: string; subject?: string
  duration_secs?: number; recording_url?: string; ai_summary?: string
  status?: string; created_at: string; from_number?: string; to_number?: string
  contacts?: { id: string; first_name: string; last_name: string } | null
}

const TAB_ICON: Record<Tab, React.ReactNode> = {
  feed:     <MessageSquare size={15} />,
  call:     <Phone size={15} />,
  sms:      <MessageSquare size={15} />,
  email:    <Mail size={15} />,
  whatsapp: <span>🟢</span>,
}

export default function CommunicationsClient({
  contacts, recentComms, smsTemplates, emailTemplates, defaultTab, defaultContact,
}: {
  contacts: Contact[]
  recentComms: Comm[]
  smsTemplates: Array<{ id: string; name: string; body: string; category?: string }>
  emailTemplates: Array<{ id: string; name: string; subject: string; html_body: string }>
  defaultTab: string
  defaultContact?: string
}) {
  const [tab, setTab]               = useState<Tab>((defaultTab as Tab) || 'feed')
  const [selectedContact, setContact] = useState(defaultContact ?? '')
  const [message, setMessage]       = useState('')
  const [subject, setSubject]       = useState('')
  const [htmlBody, setHtmlBody]     = useState('')
  const [sending, setSending]       = useState(false)
  const [calling, setCalling]       = useState(false)

  const contact = contacts.find((c) => c.id === selectedContact)

  async function makeCall() {
    if (!contact?.phone) return toast.error('No phone number')
    setCalling(true)
    const res = await fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: selectedContact, to: contact.phone }),
    })
    setCalling(false)
    if (res.ok) toast.success(`Calling ${fmt.name(contact.first_name, contact.last_name)}…`)
    else toast.error('Call failed')
  }

  async function sendSms() {
    if (!contact?.phone || !message.trim()) return
    setSending(true)
    const res = await fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: selectedContact, to: contact.phone, body: message }),
    })
    setSending(false)
    if (res.ok) { toast.success('SMS sent!'); setMessage('') }
    else toast.error('SMS failed')
  }

  async function sendEmail() {
    if (!contact?.email || !subject.trim() || !htmlBody.trim()) return
    setSending(true)
    const res = await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: selectedContact, to: contact.email, subject, html: htmlBody }),
    })
    setSending(false)
    if (res.ok) { toast.success('Email sent!'); setSubject(''); setHtmlBody('') }
    else toast.error('Email failed')
  }

  async function sendWhatsApp() {
    if (!contact?.whatsapp || !message.trim()) return
    setSending(true)
    const res = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: selectedContact, to: contact.whatsapp, body: message }),
    })
    setSending(false)
    if (res.ok) { toast.success('WhatsApp sent!'); setMessage('') }
    else toast.error('WhatsApp failed')
  }

  const TABS: Tab[] = ['feed', 'call', 'sms', 'email', 'whatsapp']
  const TAB_LABELS: Record<Tab, string> = {
    feed: 'Activity Feed', call: 'Call', sms: 'SMS', email: 'Email', whatsapp: 'WhatsApp'
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-dark-800">Communications</h1>
        <p className="text-gray-500 text-sm">Call, text, email, and WhatsApp — all in one place</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1.5 shadow-sm w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-base
              ${tab === t ? 'bg-gold-500 text-dark-800' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>
            {TAB_ICON[t]} {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left panel — compose / action */}
        <div className="col-span-2 space-y-4">
          {/* Contact selector (all tabs except feed) */}
          {tab !== 'feed' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Contact</label>
              <select
                value={selectedContact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gold-500"
              >
                <option value="">Choose a contact…</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {fmt.name(c.first_name, c.last_name)} — {fmt.phone(c.phone)}
                  </option>
                ))}
              </select>

              {contact && (
                <div className="mt-3 p-3 bg-gold-50 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 bg-gold-500 rounded-full flex items-center justify-center">
                    <span className="text-dark-800 font-bold text-sm">{fmt.initials(contact.first_name, contact.last_name)}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-dark-800 text-sm">{fmt.name(contact.first_name, contact.last_name)}</div>
                    <div className="text-xs text-gray-500">{fmt.phone(contact.phone)} · {contact.email}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CALL tab */}
          {tab === 'call' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-bold text-dark-800 mb-4">Click-to-Call</h3>
              <p className="text-sm text-gray-500 mb-4">
                Calls are made from your Asset Lift Lending number, recorded automatically, and transcribed by AI. Your personal cell will also ring simultaneously.
              </p>
              <button
                onClick={makeCall}
                disabled={!contact?.phone || calling}
                className="w-full flex items-center justify-center gap-3 bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-lg transition-base"
              >
                <Phone size={22} />
                {calling ? 'Connecting…' : `Call ${contact ? fmt.name(contact.first_name, contact.last_name) : '—'}`}
              </button>
              {!contact && (
                <p className="text-center text-xs text-gray-400 mt-3">Select a contact above to enable calling</p>
              )}
            </div>
          )}

          {/* SMS tab */}
          {tab === 'sms' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-dark-800">Send SMS</h3>
              {/* Templates */}
              {smsTemplates.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Quick Templates</label>
                  <div className="flex flex-wrap gap-2">
                    {smsTemplates.slice(0, 4).map((t) => (
                      <button key={t.id} onClick={() => setMessage(t.body)}
                        className="text-xs bg-gold-50 text-gold-700 border border-gold-200 px-3 py-1.5 rounded-xl hover:bg-gold-100 transition-base">
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message… or pick a template above"
                rows={4}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold-500 resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{message.length}/160 chars</span>
                <button
                  onClick={sendSms}
                  disabled={!contact?.phone || !message.trim() || sending}
                  className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800 font-bold px-5 py-2.5 rounded-xl text-sm transition-base"
                >
                  <Send size={14} /> {sending ? 'Sending…' : 'Send SMS'}
                </button>
              </div>
            </div>
          )}

          {/* Email tab */}
          {tab === 'email' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-dark-800">Send Email</h3>
              {emailTemplates.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Templates</label>
                  <div className="flex flex-wrap gap-2">
                    {emailTemplates.map((t) => (
                      <button key={t.id}
                        onClick={() => { setSubject(t.subject); setHtmlBody(t.html_body) }}
                        className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-base">
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line…"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500"
              />
              <textarea
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                placeholder="Email body (HTML or plain text)…"
                rows={8}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold-500 resize-none font-mono text-xs"
              />
              <div className="flex justify-end">
                <button
                  onClick={sendEmail}
                  disabled={!contact?.email || !subject.trim() || !htmlBody.trim() || sending}
                  className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800 font-bold px-5 py-2.5 rounded-xl text-sm transition-base"
                >
                  <Send size={14} /> {sending ? 'Sending…' : 'Send Email'}
                </button>
              </div>
            </div>
          )}

          {/* WhatsApp tab */}
          {tab === 'whatsapp' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-dark-800">Send WhatsApp</h3>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700">
                📱 Connected to your WhatsApp Business number via Twilio API. Messages must use pre-approved templates for outbound contacts not yet opted in.
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="WhatsApp message…"
                rows={4}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400 resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={sendWhatsApp}
                  disabled={!contact?.whatsapp || !message.trim() || sending}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-base"
                >
                  🟢 {sending ? 'Sending…' : 'Send WhatsApp'}
                </button>
              </div>
            </div>
          )}

          {/* Activity Feed tab */}
          {tab === 'feed' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 p-5">
                <h3 className="font-bold text-dark-800">Recent Activity</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {recentComms.map((c) => (
                  <div key={c.id} className="flex items-start gap-4 p-4">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">
                      {c.type === 'call' ? '📞' : c.type === 'sms' ? '💬' : c.type === 'email' ? '📧' : '🟢'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-dark-800">
                          {c.contacts ? fmt.name(c.contacts.first_name, c.contacts.last_name) : 'Unknown'}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${c.direction === 'inbound' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                          {c.direction ?? 'out'}
                        </span>
                        <span className="text-xs text-gray-400 capitalize">{c.type}</span>
                        {c.duration_secs && <span className="text-xs text-gray-400">{fmt.callDuration(c.duration_secs)}</span>}
                      </div>
                      {c.body && <div className="text-sm text-gray-600 truncate">{c.body}</div>}
                      {c.ai_summary && (
                        <div className="text-xs text-purple-600 mt-1 bg-purple-50 px-2 py-1 rounded-lg">
                          🤖 {c.ai_summary}
                        </div>
                      )}
                      {c.recording_url && (
                        <a href={c.recording_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-gold-600 hover:underline mt-1">
                          <Play size={11} /> Play Recording
                        </a>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{fmt.relativeTime(c.created_at)}</span>
                  </div>
                ))}
                {!recentComms.length && (
                  <div className="text-center py-12 text-gray-400">No communications yet</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right panel — quick stats */}
        <div className="space-y-4">
          <div className="bg-dark-800 rounded-2xl p-5 text-white">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Your Numbers</div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-400">Business Line</div>
                <div className="font-mono text-gold-400 font-bold">{process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? 'Configure in Settings'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Cell (Forwarding)</div>
                <div className="font-mono text-gold-400 font-bold">Connected ✓</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">WhatsApp Business</div>
                <div className="font-mono text-green-400 font-bold">Active ✓</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Email</div>
                <div className="text-gold-400 text-xs">info@assetliftlending.com</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Today&apos;s Stats</div>
            {[
              { label: 'Calls Made', val: recentComms.filter(c => c.type === 'call' && c.direction === 'outbound').length },
              { label: 'SMS Sent', val: recentComms.filter(c => c.type === 'sms').length },
              { label: 'Emails Sent', val: recentComms.filter(c => c.type === 'email').length },
            ].map(s => (
              <div key={s.label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{s.label}</span>
                <span className="text-sm font-bold text-dark-800">{s.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
