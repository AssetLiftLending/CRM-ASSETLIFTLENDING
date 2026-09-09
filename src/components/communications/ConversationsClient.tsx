'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Phone, MessageSquare, Mail, Send, Play, Search, Loader2,
  ExternalLink, AlertTriangle, RefreshCw, Inbox, StickyNote,
} from 'lucide-react'
import { fmt, cn, STAGE_COLORS } from '@/lib/utils/format'
import toast from 'react-hot-toast'

type ChannelKey = 'sms' | 'call' | 'whatsapp' | 'email'

interface ChannelStatus {
  key: ChannelKey
  label: string
  configured: boolean
  detail: string
  missing: string[]
}

interface ContactSummary {
  id: string
  first_name?: string
  last_name?: string
  email?: string | null
  phone?: string | null
  cell_phone?: string | null
  whatsapp?: string | null
  stage?: string | null
  lead_source?: string | null
  created_at?: string
}

interface Conversation {
  contact_id: string
  contact: ContactSummary
  last_message: { id: string; type: string; direction?: string; preview: string; created_at: string }
  unread: number
  channels: string[]
  message_count: number
}

interface Message {
  id: string
  type: string
  direction?: string | null
  subject?: string | null
  body?: string | null
  snippet?: string | null
  status?: string | null
  duration_secs?: number | null
  recording_url?: string | null
  ai_summary?: string | null
  voicemail?: boolean | null
  from_number?: string | null
  to_number?: string | null
  from_email?: string | null
  to_email?: string | null
  created_at: string
  read_at?: string | null
}

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  call: <Phone size={13} />,
  sms: <MessageSquare size={13} />,
  email: <Mail size={13} />,
  whatsapp: <span className="text-[11px] leading-none">🟢</span>,
  note: <StickyNote size={13} />,
}

/** Inbound email bodies are untrusted HTML — render them as text, never markup. */
function toText(html?: string | null): string {
  if (!html) return ''
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function dayKey(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86400000)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(d, today)) return 'Today'
  if (same(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  })
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

interface Template {
  id: string
  name: string
  body?: string | null
  subject?: string | null
  html_body?: string | null
}

export default function ConversationsClient({
  initialConversations,
  channels,
  readTracking,
  defaultContact,
  loadError,
  smsTemplates = [],
  emailTemplates = [],
}: {
  initialConversations: Conversation[]
  channels: ChannelStatus[]
  readTracking: boolean
  defaultContact?: string
  loadError?: string | null
  smsTemplates?: Template[]
  emailTemplates?: Template[]
}) {
  const [conversations, setConversations] = useState(initialConversations)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | undefined>(
    defaultContact ?? initialConversations[0]?.contact_id
  )
  const [contact, setContact] = useState<ContactSummary | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [channel, setChannel] = useState<ChannelKey>('sms')
  const [draft, setDraft] = useState('')
  const [subject, setSubject] = useState('')
  const [sending, setSending] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const byKey = useMemo(
    () => Object.fromEntries(channels.map((c) => [c.key, c])) as Record<ChannelKey, ChannelStatus>,
    [channels]
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return conversations.filter((c) => {
      if (filter === 'unread' && c.unread === 0) return false
      if (!q) return true
      const name = fmt.name(c.contact.first_name, c.contact.last_name).toLowerCase()
      return (
        name.includes(q) ||
        (c.contact.email ?? '').toLowerCase().includes(q) ||
        (c.contact.phone ?? '').includes(q) ||
        c.last_message.preview.toLowerCase().includes(q)
      )
    })
  }, [conversations, filter, search])

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch('/api/communications')
      if (!res.ok) return
      const json = await res.json()
      setConversations(json.conversations ?? [])
    } catch {
      /* transient — the next poll retries */
    }
  }, [])

  const openThread = useCallback(async (contactId: string) => {
    setActiveId(contactId)
    setLoadingThread(true)
    try {
      const res = await fetch(`/api/communications/thread?contact_id=${encodeURIComponent(contactId)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not load this conversation')
      setContact(json.contact)
      setMessages(json.messages ?? [])

      if (readTracking) {
        fetch('/api/communications/thread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contact_id: contactId }),
        }).then(() => {
          setConversations((prev) =>
            prev.map((c) => (c.contact_id === contactId ? { ...c, unread: 0 } : c))
          )
        }).catch(() => {})
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load this conversation')
      setMessages([])
    } finally {
      setLoadingThread(false)
    }
  }, [readTracking])

  useEffect(() => {
    if (activeId) openThread(activeId)
    // Only on first mount / when the selected thread id changes from outside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // Keep the list current without hammering the API when the tab is hidden.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refreshList()
    }, 30000)
    return () => clearInterval(id)
  }, [refreshList])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  // Default the composer to a channel that can actually reach this contact.
  useEffect(() => {
    if (!contact) return
    const usable = (k: ChannelKey) => {
      if (!byKey[k]?.configured) return false
      if (k === 'sms') return Boolean(contact.phone || contact.cell_phone)
      if (k === 'email') return Boolean(contact.email)
      if (k === 'whatsapp') return Boolean(contact.whatsapp)
      return false
    }
    if (!usable(channel)) {
      const next = (['sms', 'email', 'whatsapp'] as ChannelKey[]).find(usable)
      if (next) setChannel(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, byKey])

  const activeConv = conversations.find((c) => c.contact_id === activeId)
  const headerContact = contact ?? activeConv?.contact ?? null

  const recipient =
    channel === 'email' ? contact?.email
    : channel === 'whatsapp' ? contact?.whatsapp
    : contact?.phone || contact?.cell_phone

  const channelReady = byKey[channel]?.configured ?? false
  const canSend =
    Boolean(recipient) && channelReady && draft.trim().length > 0 &&
    (channel !== 'email' || subject.trim().length > 0) && !sending

  async function send() {
    if (!canSend || !contact) return
    setSending(true)

    const endpoint =
      channel === 'email' ? '/api/email' : channel === 'whatsapp' ? '/api/whatsapp' : '/api/sms'
    const payload =
      channel === 'email'
        ? { contactId: contact.id, to: recipient, subject, html: draft, text: draft }
        : { contactId: contact.id, to: recipient, body: draft }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Message could not be sent')

      setDraft('')
      setSubject('')
      toast.success(`${byKey[channel].label} sent`)
      await openThread(contact.id)
      refreshList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Message could not be sent')
    } finally {
      setSending(false)
    }
  }

  async function call() {
    const to = contact?.phone || contact?.cell_phone
    if (!to || !contact) return
    if (!byKey.call?.configured) {
      toast.error(`Calling is not connected. Add ${byKey.call?.missing.join(', ')}.`)
      return
    }
    const res = await fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: contact.id, to }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) toast.success(`Calling ${fmt.name(contact.first_name, contact.last_name)}…`)
    else toast.error(json.error ?? 'Call failed')
  }

  const unconfigured = channels.filter((c) => !c.configured)

  // Templates are stored with {{first_name}}-style placeholders. Resolve them
  // against the open contact so the user edits the real message, not the token.
  const templates = channel === 'email' ? emailTemplates : smsTemplates

  function fill(text: string): string {
    const vars: Record<string, string> = {
      first_name: contact?.first_name ?? '',
      last_name: contact?.last_name ?? '',
      contact_name: fmt.name(contact?.first_name, contact?.last_name),
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      agent_name: 'Asset Lift Lending',
    }
    return text.replace(/\{\{(\w+)\}\}/g, (whole, key) => vars[key] ?? whole)
  }

  function applyTemplate(t: Template) {
    if (channel === 'email') {
      setSubject(fill(t.subject ?? ''))
      setDraft(fill(toText(t.html_body) || t.body || ''))
    } else {
      setDraft(fill(t.body ?? ''))
    }
  }

  // Group messages under date separators.
  const groups: Array<{ day: string; items: Message[] }> = []
  for (const m of messages) {
    const day = dayKey(m.created_at)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(m)
    else groups.push({ day, items: [m] })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] min-h-[34rem]">
      <div className="flex items-baseline justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-dark-800">Conversations</h1>
          <p className="text-gray-500 text-sm">Every call, text, email and WhatsApp with a contact, in one thread</p>
        </div>
        <button
          onClick={async () => { setRefreshing(true); await refreshList(); if (activeId) await openThread(activeId); setRefreshing(false) }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-dark-800 transition-base"
        >
          <RefreshCw size={13} className={cn(refreshing && 'animate-spin')} /> Refresh
        </button>
      </div>

      {loadError && (
        <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex-shrink-0">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {unconfigured.length > 0 && (
        <div className="mb-3 flex items-start gap-2 bg-gold-50 border border-gold-200 rounded-xl px-4 py-3 text-sm text-gold-800 flex-shrink-0">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>
            <strong>{unconfigured.map((c) => c.label).join(', ')}</strong>{' '}
            {unconfigured.length === 1 ? 'is' : 'are'} not connected — messages on{' '}
            {unconfigured.length === 1 ? 'that channel' : 'those channels'} cannot be sent.
            Missing: <code className="text-xs">{[...new Set(unconfigured.flatMap((c) => c.missing))].join(', ')}</code>
          </span>
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-[19rem_1fr_17rem] gap-4">
        {/* ── Conversation list ─────────────────────────── */}
        <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 space-y-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Inbox size={16} className="text-gold-500" />
              <h2 className="font-bold text-dark-800 text-sm">Team Inbox</h2>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-gold-500"
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'unread'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'flex-1 text-xs font-medium py-1.5 rounded-lg capitalize transition-base',
                    filter === f ? 'bg-gold-500 text-dark-800' : 'text-gray-500 hover:bg-gray-50'
                  )}
                >
                  {f}
                  {f === 'unread' && readTracking && (
                    <span className="ml-1">
                      ({conversations.reduce((n, c) => n + (c.unread > 0 ? 1 : 0), 0)})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {visible.map((c) => {
              const active = c.contact_id === activeId
              return (
                <button
                  key={c.contact_id}
                  onClick={() => openThread(c.contact_id)}
                  className={cn(
                    'w-full text-left px-4 py-3 flex gap-3 transition-base',
                    active ? 'bg-gold-50 border-l-2 border-gold-500' : 'hover:bg-gray-50 border-l-2 border-transparent'
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-gold-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-gold-700 font-bold text-xs">
                      {fmt.initials(c.contact.first_name, c.contact.last_name)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-sm truncate', c.unread > 0 ? 'font-bold text-dark-800' : 'font-semibold text-dark-800')}>
                        {fmt.name(c.contact.first_name, c.contact.last_name)}
                      </span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">
                        {fmt.relativeTime(c.last_message.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-gray-400 flex-shrink-0">
                        {CHANNEL_ICON[c.last_message.type] ?? CHANNEL_ICON.note}
                      </span>
                      <span className={cn('text-xs truncate', c.unread > 0 ? 'text-dark-800 font-medium' : 'text-gray-500')}>
                        {c.last_message.direction === 'outbound' && <span className="text-gray-400">You: </span>}
                        {c.last_message.preview || '(no text)'}
                      </span>
                      {c.unread > 0 && (
                        <span className="ml-auto flex-shrink-0 bg-gold-500 text-dark-800 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}

            {!visible.length && (
              <div className="text-center py-12 px-4 text-sm text-gray-400">
                {conversations.length
                  ? 'No conversations match that search.'
                  : 'No conversations yet. They appear here as soon as a contact calls, texts or emails.'}
              </div>
            )}
          </div>
        </aside>

        {/* ── Thread ────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-0 overflow-hidden">
          {headerContact ? (
            <>
              <header className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-gold-100 flex items-center justify-center">
                  <span className="text-gold-700 font-bold text-xs">
                    {fmt.initials(headerContact.first_name, headerContact.last_name)}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-dark-800 truncate">
                    {fmt.name(headerContact.first_name, headerContact.last_name)}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {[fmt.phone(headerContact.phone), headerContact.email].filter((v) => v && v !== '—').join(' · ')}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={call}
                    title={byKey.call?.configured ? 'Call this contact' : 'Calling is not connected'}
                    disabled={!headerContact.phone && !headerContact.cell_phone}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition-base"
                  >
                    <Phone size={17} />
                  </button>
                  <Link
                    href={`/contacts/${headerContact.id}`}
                    title="Open full contact record"
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gold-600 transition-base"
                  >
                    <ExternalLink size={17} />
                  </Link>
                </div>
              </header>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {loadingThread && (
                  <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
                    <Loader2 size={15} className="animate-spin" /> Loading conversation…
                  </div>
                )}

                {!loadingThread && !messages.length && (
                  <div className="text-center py-12 text-sm text-gray-400">
                    No messages with this contact yet. Send the first one below.
                  </div>
                )}

                {!loadingThread && groups.map((group) => (
                  <div key={group.day} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="text-[11px] font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
                        {group.day}
                      </span>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>

                    {group.items.map((m) => {
                      const inbound = m.direction === 'inbound'
                      const text = m.type === 'email' ? toText(m.body || m.snippet) : (m.body ?? '')
                      return (
                        <div key={m.id} className={cn('flex', inbound ? 'justify-start' : 'justify-end')}>
                          <div className={cn('max-w-[78%] min-w-0', inbound ? 'items-start' : 'items-end')}>
                            <div
                              className={cn(
                                'rounded-2xl px-4 py-2.5 border',
                                inbound
                                  ? 'bg-gray-50 border-gray-100 rounded-tl-sm'
                                  : 'bg-gold-50 border-gold-200 rounded-tr-sm'
                              )}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-gray-400">{CHANNEL_ICON[m.type] ?? CHANNEL_ICON.note}</span>
                                <span className="text-[11px] font-medium text-gray-500 capitalize">{m.type}</span>
                                {m.voicemail && (
                                  <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">voicemail</span>
                                )}
                                {m.status && (
                                  <span className="text-[10px] text-gray-400">· {m.status}</span>
                                )}
                              </div>

                              {m.subject && (
                                <div className="text-sm font-semibold text-dark-800 mb-1 break-words">{m.subject}</div>
                              )}

                              {text && (
                                <div className="text-sm text-dark-800 whitespace-pre-wrap break-words">{text}</div>
                              )}

                              {m.type === 'call' && (
                                <div className="text-sm text-dark-800">
                                  {inbound ? 'Incoming call' : 'Outgoing call'}
                                  {m.duration_secs ? ` · ${fmt.callDuration(m.duration_secs)}` : ''}
                                </div>
                              )}

                              {m.ai_summary && (
                                <div className="mt-1.5 text-xs text-purple-700 bg-purple-50 px-2 py-1 rounded-lg break-words">
                                  🤖 {m.ai_summary}
                                </div>
                              )}

                              {m.recording_url && (
                                <a
                                  href={m.recording_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-gold-700 hover:underline mt-1.5"
                                >
                                  <Play size={11} /> Play recording
                                </a>
                              )}
                            </div>
                            <div className={cn('text-[11px] text-gray-400 mt-1 px-1', inbound ? 'text-left' : 'text-right')}>
                              {timeOf(m.created_at)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Composer */}
              <div className="border-t border-gray-100 p-3 flex-shrink-0 space-y-2">
                <div className="flex gap-1">
                  {(['sms', 'email', 'whatsapp'] as ChannelKey[]).map((k) => {
                    const status = byKey[k]
                    const address =
                      k === 'email' ? contact?.email : k === 'whatsapp' ? contact?.whatsapp : contact?.phone || contact?.cell_phone
                    const disabled = !status?.configured || !address
                    return (
                      <button
                        key={k}
                        onClick={() => setChannel(k)}
                        disabled={disabled}
                        title={
                          !status?.configured
                            ? `${status?.label} is not connected — missing ${status?.missing.join(', ')}`
                            : !address
                              ? `This contact has no ${k === 'email' ? 'email address' : k === 'whatsapp' ? 'WhatsApp number' : 'phone number'}`
                              : `Send by ${status.label}`
                        }
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-base',
                          channel === k && !disabled
                            ? 'bg-gold-500 text-dark-800'
                            : 'text-gray-500 hover:bg-gray-50',
                          disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
                        )}
                      >
                        {CHANNEL_ICON[k]} {status?.label ?? k}
                      </button>
                    )
                  })}
                </div>

                {templates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => applyTemplate(t)}
                        className="text-[11px] bg-gold-50 text-gold-700 border border-gold-200 px-2.5 py-1 rounded-lg hover:bg-gold-100 transition-base"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}

                {channel === 'email' && (
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                  />
                )}

                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() }
                    }}
                    rows={2}
                    placeholder={
                      !channelReady
                        ? `${byKey[channel]?.label} is not connected`
                        : !recipient
                          ? 'This contact has no address for this channel'
                          : 'Type a message…  (⌘/Ctrl + Enter to send)'
                    }
                    disabled={!channelReady || !recipient}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500 resize-none disabled:opacity-60"
                  />
                  <button
                    onClick={send}
                    disabled={!canSend}
                    className="flex items-center justify-center bg-gold-500 hover:bg-gold-400 disabled:opacity-40 disabled:cursor-not-allowed text-dark-800 font-bold w-11 h-11 rounded-xl transition-base flex-shrink-0"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 px-6 text-center">
              Select a conversation to read the full history.
            </div>
          )}
        </section>

        {/* ── Contact details ───────────────────────────── */}
        <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-0 overflow-y-auto">
          {headerContact ? (
            <div className="p-5 space-y-5">
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Contact</div>
                <div className="space-y-2.5 text-sm">
                  <Field label="Name" value={fmt.name(headerContact.first_name, headerContact.last_name)} />
                  <Field label="Email" value={headerContact.email ?? '—'} />
                  <Field label="Phone" value={fmt.phone(headerContact.phone)} />
                  {headerContact.whatsapp && <Field label="WhatsApp" value={fmt.phone(headerContact.whatsapp)} />}
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Stage</div>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      STAGE_COLORS[headerContact.stage ?? ''] ?? 'bg-gray-100 text-gray-600'
                    )}>
                      {fmt.stage(headerContact.stage ?? undefined)}
                    </span>
                  </div>
                  <Field label="Lead source" value={(headerContact.lead_source ?? 'direct').replace(/_/g, ' ')} />
                  {activeConv && <Field label="Messages" value={String(activeConv.message_count)} />}
                </div>
              </div>

              <Link
                href={`/contacts/${headerContact.id}`}
                className="flex items-center justify-center gap-1.5 w-full bg-dark-800 hover:bg-dark-700 text-white text-sm font-medium py-2.5 rounded-xl transition-base"
              >
                Open full record <ExternalLink size={13} />
              </Link>

              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Channels</div>
                <div className="space-y-2">
                  {channels.map((c) => (
                    <div key={c.key} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-600">{c.label}</span>
                      {c.configured ? (
                        <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                          {c.detail || 'Connected'}
                        </span>
                      ) : (
                        <span
                          title={`Missing ${c.missing.join(', ')}`}
                          className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-medium"
                        >
                          Not connected
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 p-6 text-center">
              Contact details appear here.
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-dark-800 break-words">{value}</div>
    </div>
  )
}
