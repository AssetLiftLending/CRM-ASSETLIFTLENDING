'use client'

import { useState, useCallback } from 'react'
import {
  Globe, Search, FileText, BarChart2, Calendar, Users2,
  Plus, RefreshCw, ChevronDown, ChevronUp, ExternalLink,
  Copy, Check, Download, Trash2, Eye, Send, AlertCircle,
  TrendingUp, Zap, Target, Award, ArrowRight, X, Edit3,
  Layout, Mail, Image, Tag, MessageSquare, PlayCircle
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Website {
  id: string
  name: string
  url: string
  industry: string
  location: string
  target_audience: string
  competitors: string[]
  primary_keywords: string[]
  notes: string
  seo_audits: Array<{ id: string; score: number; status: string; created_at: string }>
  generated_content: Array<{ id: string; type: string; status: string }>
}

type Tab = 'dashboard' | 'audit' | 'keywords' | 'content' | 'calendar' | 'competitors'

const CONTENT_TYPES = [
  { key: 'blog_post', label: 'Blog Post', icon: FileText, color: 'text-blue-400' },
  { key: 'social_instagram', label: 'Instagram', icon: Image, color: 'text-pink-400' },
  { key: 'social_facebook', label: 'Facebook', icon: MessageSquare, color: 'text-blue-500' },
  { key: 'social_linkedin', label: 'LinkedIn', icon: Users2, color: 'text-sky-400' },
  { key: 'social_twitter', label: 'Twitter/X', icon: MessageSquare, color: 'text-gray-300' },
  { key: 'email_newsletter', label: 'Newsletter', icon: Mail, color: 'text-green-400' },
  { key: 'email_sequence', label: 'Email Sequence', icon: Mail, color: 'text-emerald-400' },
  { key: 'google_ad', label: 'Google Ads', icon: Target, color: 'text-yellow-400' },
  { key: 'meta_ad', label: 'Meta Ads', icon: Layout, color: 'text-purple-400' },
  { key: 'meta_tags', label: 'Meta Tags', icon: Tag, color: 'text-orange-400' },
  { key: 'content_calendar', label: 'Content Calendar', icon: Calendar, color: 'text-teal-400' },
]

const TABS: Array<{ key: Tab; label: string; icon: any }> = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart2 },
  { key: 'audit', label: 'SEO Audit', icon: Search },
  { key: 'keywords', label: 'Keywords', icon: TrendingUp },
  { key: 'content', label: 'Content Generator', icon: FileText },
  { key: 'calendar', label: 'Content Calendar', icon: Calendar },
  { key: 'competitors', label: 'Competitors', icon: Users2 },
]

// ─── Helper: Score Ring ───────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = size / 2 - 8
  const circ = 2 * Math.PI * r
  const pct = score / 100
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#374151" strokeWidth={6} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fill="white" fontSize={size * 0.22} fontWeight="bold">{score}</text>
    </svg>
  )
}

// ─── Helper: Status Badge ─────────────────────────────────────────────────────

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-gray-700 text-gray-300',
    approved: 'bg-blue-900 text-blue-300',
    published: 'bg-green-900 text-green-300',
    archived: 'bg-gray-800 text-gray-500',
    high: 'bg-red-900 text-red-300',
    medium: 'bg-yellow-900 text-yellow-300',
    low: 'bg-green-900 text-green-300',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-gray-700 text-gray-300'}`}>
      {status}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SEOHubClient({ initialWebsites }: { initialWebsites: Website[] }) {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [websites, setWebsites] = useState<Website[]>(initialWebsites)
  const [activeWebsite, setActiveWebsite] = useState<Website | null>(initialWebsites[0] ?? null)

  // Refresh websites list
  const refreshWebsites = useCallback(async () => {
    const res = await fetch('/api/seo/websites')
    if (res.ok) {
      const { websites: ws } = await res.json()
      setWebsites(ws)
      if (activeWebsite) {
        const updated = ws.find((w: Website) => w.id === activeWebsite.id)
        if (updated) setActiveWebsite(updated)
      }
    }
  }, [activeWebsite])

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Top Bar */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#D4A017] flex items-center justify-center">
            <Globe className="w-4 h-4 text-black" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">SEO & Marketing Hub</h1>
            <p className="text-xs text-gray-500 mt-0.5">AI-powered content & optimization</p>
          </div>
        </div>

        {/* Website selector */}
        <div className="flex items-center gap-3">
          {websites.length > 0 && (
            <select
              value={activeWebsite?.id ?? ''}
              onChange={e => setActiveWebsite(websites.find(w => w.id === e.target.value) ?? null)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 min-w-[200px]"
            >
              {websites.map(w => (
                <option key={w.id} value={w.id}>{w.name} — {w.url}</option>
              ))}
            </select>
          )}
          <AddWebsiteButton onAdded={refreshWebsites} />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.key
                ? 'border-[#D4A017] text-[#D4A017]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {!activeWebsite && tab !== 'dashboard' ? (
          <div className="text-center py-20 text-gray-500">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Add a website to get started</p>
          </div>
        ) : (
          <>
            {tab === 'dashboard' && <DashboardTab websites={websites} activeWebsite={activeWebsite} setTab={setTab} setActiveWebsite={setActiveWebsite} onRefresh={refreshWebsites} />}
            {tab === 'audit' && activeWebsite && <AuditTab website={activeWebsite} onRefresh={refreshWebsites} />}
            {tab === 'keywords' && activeWebsite && <KeywordsTab website={activeWebsite} />}
            {tab === 'content' && activeWebsite && <ContentTab website={activeWebsite} />}
            {tab === 'calendar' && activeWebsite && <CalendarTab website={activeWebsite} />}
            {tab === 'competitors' && activeWebsite && <CompetitorsTab website={activeWebsite} />}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Add Website Button ───────────────────────────────────────────────────────

function AddWebsiteButton({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: '', url: '', industry: '', location: '', target_audience: '',
    primary_keywords: '', competitors: '', notes: ''
  })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    await fetch('/api/seo/websites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        primary_keywords: form.primary_keywords.split(',').map(s => s.trim()).filter(Boolean),
        competitors: form.competitors.split(',').map(s => s.trim()).filter(Boolean),
      }),
    })
    setLoading(false)
    setOpen(false)
    setForm({ name: '', url: '', industry: '', location: '', target_audience: '', primary_keywords: '', competitors: '', notes: '' })
    onAdded()
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-[#D4A017] text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#e5b01e] transition-colors">
        <Plus className="w-4 h-4" /> Add Website
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-xl border border-gray-700 w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Add Website</h2>
              <button onClick={() => setOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              {[
                ['name', 'Business Name', 'Asset Lift Lending'],
                ['url', 'Website URL', 'https://example.com'],
                ['industry', 'Industry', 'Hard Money Lending'],
                ['location', 'Location', 'New York, NY'],
                ['target_audience', 'Target Audience', 'Real estate investors'],
                ['primary_keywords', 'Primary Keywords (comma-separated)', 'hard money loans, bridge loans'],
                ['competitors', 'Competitors (comma-separated)', 'competitor1.com, competitor2.com'],
              ].map(([key, label, placeholder]) => (
                <div key={key}>
                  <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={submit}
              disabled={loading || !form.name || !form.url}
              className="mt-5 w-full bg-[#D4A017] text-black py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Website'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ websites, activeWebsite, setTab, setActiveWebsite, onRefresh }: {
  websites: Website[]
  activeWebsite: Website | null
  setTab: (t: Tab) => void
  setActiveWebsite: (w: Website) => void
  onRefresh: () => void
}) {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Websites', value: websites.length, color: 'text-[#D4A017]' },
          { label: 'Total Content', value: websites.reduce((a, w) => a + w.generated_content.length, 0), color: 'text-blue-400' },
          { label: 'Published', value: websites.reduce((a, w) => a + w.generated_content.filter(c => c.status === 'published').length, 0), color: 'text-green-400' },
          { label: 'Audits Run', value: websites.reduce((a, w) => a + w.seo_audits.filter(a => a.status === 'completed').length, 0), color: 'text-purple-400' },
        ].map(card => (
          <div key={card.label} className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-5">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Website cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Your Websites</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {websites.map(w => {
            const latestAudit = w.seo_audits?.find(a => a.status === 'completed')
            const contentCount = w.generated_content?.length ?? 0
            const publishedCount = w.generated_content?.filter(c => c.status === 'published').length ?? 0
            return (
              <div key={w.id} className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-5 hover:border-gray-600 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">{w.name}</h3>
                    <a href={w.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#D4A017] flex items-center gap-1 mt-0.5">
                      {w.url} <ExternalLink className="w-3 h-3" />
                    </a>
                    <p className="text-xs text-gray-500 mt-1">{w.industry} · {w.location}</p>
                  </div>
                  {latestAudit && <ScoreRing score={latestAudit.score} size={60} />}
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div className="bg-gray-800/50 rounded-lg p-2">
                    <p className="text-lg font-bold text-white">{contentCount}</p>
                    <p className="text-xs text-gray-500">Content</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-2">
                    <p className="text-lg font-bold text-green-400">{publishedCount}</p>
                    <p className="text-xs text-gray-500">Published</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-2">
                    <p className="text-lg font-bold text-blue-400">{w.seo_audits?.length ?? 0}</p>
                    <p className="text-xs text-gray-500">Audits</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setActiveWebsite(w); setTab('audit') }}
                    className="flex-1 text-xs bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <Search className="w-3 h-3" /> Run Audit
                  </button>
                  <button
                    onClick={() => { setActiveWebsite(w); setTab('content') }}
                    className="flex-1 text-xs bg-[#D4A017]/10 hover:bg-[#D4A017]/20 text-[#D4A017] py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <FileText className="w-3 h-3" /> Create Content
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Audit Tab ────────────────────────────────────────────────────────────────

function AuditTab({ website, onRefresh }: { website: Website; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false)
  const [audit, setAudit] = useState<any>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const runAudit = async () => {
    setLoading(true)
    setAudit(null)
    const res = await fetch('/api/seo/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ website_id: website.id }),
    })
    const data = await res.json()
    if (data.audit) setAudit(data.audit)
    setLoading(false)
    onRefresh()
  }

  const toggle = (key: string) => setExpanded(e => ({ ...e, [key]: !e[key] }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">SEO Audit</h2>
          <p className="text-sm text-gray-400">{website.name} — {website.url}</p>
        </div>
        <button
          onClick={runAudit}
          disabled={loading}
          className="flex items-center gap-2 bg-[#D4A017] text-black px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#e5b01e] disabled:opacity-50 transition-colors"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Running Audit...' : 'Run New Audit'}
        </button>
      </div>

      {loading && (
        <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-12 text-center">
          <RefreshCw className="w-10 h-10 text-[#D4A017] animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Crawling website and running AI analysis...</p>
          <p className="text-xs text-gray-600 mt-2">This usually takes 15-30 seconds</p>
        </div>
      )}

      {audit && (
        <div className="space-y-4">
          {/* Score overview */}
          <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-6">
            <div className="flex items-center gap-8">
              <ScoreRing score={audit.score} size={100} />
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-1">Overall Score: {audit.score}/100</h3>
                <p className="text-gray-400 text-sm">{audit.summary}</p>
                <div className="flex gap-4 mt-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-400">{audit.on_page_seo?.score ?? '—'}</p>
                    <p className="text-xs text-gray-500">On-Page</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-purple-400">{audit.technical_seo?.score ?? '—'}</p>
                    <p className="text-xs text-gray-500">Technical</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-400">{audit.local_seo?.score ?? '—'}</p>
                    <p className="text-xs text-gray-500">Local</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Critical Issues */}
          {audit.critical_issues?.length > 0 && (
            <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-5">
              <h3 className="font-semibold text-red-400 flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4" /> Critical Issues ({audit.critical_issues.length})
              </h3>
              <div className="space-y-3">
                {audit.critical_issues.map((issue: any, i: number) => (
                  <div key={i} className="bg-black/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-white">{issue.issue}</span>
                      <Badge status={issue.impact} />
                    </div>
                    <p className="text-xs text-gray-400 mb-1">{issue.description}</p>
                    <p className="text-xs text-green-400">✓ Fix: {issue.fix}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick wins */}
          {audit.quick_wins?.length > 0 && (
            <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-[#D4A017]" /> Quick Wins</h3>
              <div className="space-y-2">
                {audit.quick_wins.map((win: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <ArrowRight className="w-4 h-4 text-[#D4A017] mt-0.5 flex-shrink-0" />
                    {win}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* On-Page SEO */}
          <CollapsibleSection title="On-Page SEO" open={expanded['onpage']} onToggle={() => toggle('onpage')}>
            <div className="space-y-3">
              {Object.entries(audit.on_page_seo || {}).filter(([k]) => k !== 'score').map(([key, val]: [string, any]) => (
                <div key={key} className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg">
                  <StatusDot status={val?.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize">{key.replace(/_/g, ' ')}</p>
                    {val?.current && <p className="text-xs text-gray-500 mt-0.5 truncate">Current: {val.current}</p>}
                    {val?.recommendation && <p className="text-xs text-green-400 mt-0.5">→ {val.recommendation}</p>}
                    {val?.notes && <p className="text-xs text-gray-400 mt-0.5">{val.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Technical SEO */}
          <CollapsibleSection title="Technical SEO" open={expanded['tech']} onToggle={() => toggle('tech')}>
            <div className="space-y-2">
              {(audit.technical_seo?.items || []).map((item: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-2.5 bg-gray-800/30 rounded-lg">
                  <StatusDot status={item.status === 'pass' ? 'good' : item.status === 'warn' ? 'warning' : 'critical'} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    {item.notes && <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Keyword Opportunities */}
          <CollapsibleSection title="Keyword Opportunities" open={expanded['kw']} onToggle={() => toggle('kw')}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                    <th className="pb-2 pr-4">Keyword</th>
                    <th className="pb-2 pr-4">Intent</th>
                    <th className="pb-2 pr-4">Difficulty</th>
                    <th className="pb-2">Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {(audit.keyword_opportunities || []).map((kw: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 font-medium">{kw.keyword}</td>
                      <td className="py-2 pr-4"><Badge status={kw.intent} /></td>
                      <td className="py-2 pr-4 text-gray-400 capitalize">{kw.difficulty}</td>
                      <td className="py-2 text-gray-400">{kw.volume_estimate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>

          {/* Recommendations */}
          <CollapsibleSection title="Priority Recommendations" open={expanded['recs']} onToggle={() => toggle('recs')}>
            <div className="space-y-2">
              {(audit.recommendations_priority || []).map((rec: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-[#D4A017]/20 text-[#D4A017] text-xs flex items-center justify-center font-bold flex-shrink-0">
                    {rec.priority}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{rec.action}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{rec.expected_impact}</p>
                  </div>
                  <Badge status={rec.effort} />
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* Previous audits */}
      {website.seo_audits?.filter(a => a.status === 'completed').length > 0 && !audit && !loading && (
        <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-5">
          <h3 className="font-semibold text-sm text-gray-400 mb-3">Previous Audits</h3>
          <div className="space-y-2">
            {website.seo_audits.filter(a => a.status === 'completed').slice(0, 5).map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <ScoreRing score={a.score} size={40} />
                  <div>
                    <p className="text-sm font-medium">Score: {a.score}/100</p>
                    <p className="text-xs text-gray-500">{new Date(a.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Keywords Tab ─────────────────────────────────────────────────────────────

function KeywordsTab({ website }: { website: Website }) {
  const [seedKeyword, setSeedKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [research, setResearch] = useState<any>(null)
  const [activeSection, setActiveSection] = useState('primary_keywords')

  const runResearch = async () => {
    if (!seedKeyword.trim()) return
    setLoading(true)
    const res = await fetch('/api/seo/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ website_id: website.id, seed_keyword: seedKeyword }),
    })
    const data = await res.json()
    if (data.research) setResearch(data.research)
    setLoading(false)
  }

  const SECTIONS = [
    { key: 'primary_keywords', label: 'Primary', cols: ['keyword', 'monthly_volume', 'difficulty', 'intent', 'opportunity'] },
    { key: 'long_tail_keywords', label: 'Long-tail', cols: ['keyword', 'monthly_volume', 'difficulty', 'intent'] },
    { key: 'local_keywords', label: 'Local', cols: ['keyword', 'monthly_volume', 'difficulty'] },
    { key: 'question_keywords', label: 'Questions', cols: ['question', 'intent', 'content_opportunity'] },
    { key: 'competitor_gap_keywords', label: 'Gap', cols: ['keyword', 'difficulty', 'opportunity'] },
  ]

  const activeData = research?.[activeSection] ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <input
          className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-[#D4A017] outline-none"
          placeholder="Enter seed keyword (e.g. hard money loans)"
          value={seedKeyword}
          onChange={e => setSeedKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && runResearch()}
        />
        <button
          onClick={runResearch}
          disabled={loading || !seedKeyword}
          className="bg-[#D4A017] text-black px-6 py-3 rounded-lg font-semibold text-sm disabled:opacity-50 hover:bg-[#e5b01e] flex items-center gap-2 whitespace-nowrap"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Researching...' : 'Research Keywords'}
        </button>
      </div>

      {loading && (
        <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-12 text-center">
          <TrendingUp className="w-10 h-10 text-[#D4A017] animate-pulse mx-auto mb-4" />
          <p className="text-gray-400">Researching keywords with AI...</p>
        </div>
      )}

      {research && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-5">
            <p className="text-sm text-gray-300">{research.summary}</p>
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="text-center"><p className="text-2xl font-bold text-[#D4A017]">{research.primary_keywords?.length ?? 0}</p><p className="text-xs text-gray-500">Primary KWs</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-blue-400">{research.long_tail_keywords?.length ?? 0}</p><p className="text-xs text-gray-500">Long-tail</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-green-400">{research.local_keywords?.length ?? 0}</p><p className="text-xs text-gray-500">Local</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-purple-400">{research.question_keywords?.length ?? 0}</p><p className="text-xs text-gray-500">Questions</p></div>
            </div>
          </div>

          {/* Section tabs */}
          <div className="flex gap-2 flex-wrap">
            {SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeSection === s.key ? 'bg-[#D4A017] text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              >
                {s.label} ({research[s.key]?.length ?? 0})
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50">
                  <tr>
                    {SECTIONS.find(s => s.key === activeSection)?.cols.map(col => (
                      <th key={col} className="text-left text-xs text-gray-400 px-4 py-3 capitalize">{col.replace(/_/g, ' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {activeData.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-800/20">
                      {SECTIONS.find(s => s.key === activeSection)?.cols.map(col => (
                        <td key={col} className="px-4 py-3 text-gray-300">
                          {col === 'difficulty' ? (
                            <DifficultyBar value={row[col]} />
                          ) : col === 'opportunity' ? (
                            <Badge status={row[col]} />
                          ) : col === 'intent' ? (
                            <span className="text-xs bg-gray-800 px-2 py-0.5 rounded">{row[col]}</span>
                          ) : (
                            <span className="text-sm">{row[col]}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Negative keywords */}
          {research.negative_keywords?.length > 0 && (
            <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-5">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Negative Keywords (exclude from paid ads)</h3>
              <div className="flex flex-wrap gap-2">
                {research.negative_keywords.map((kw: string, i: number) => (
                  <span key={i} className="bg-red-950/50 text-red-400 text-xs px-2.5 py-1 rounded-full border border-red-900/30">-{kw}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Content Generator Tab ────────────────────────────────────────────────────

function ContentTab({ website }: { website: Website }) {
  const [selectedType, setSelectedType] = useState(CONTENT_TYPES[0])
  const [options, setOptions] = useState({ topic: '', keyword: '', goal: '', purpose: '', page_type: 'Homepage', month: '' })
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [contentList, setContentList] = useState<any[]>([])
  const [view, setView] = useState<'generate' | 'library'>('generate')

  const generate = async () => {
    setLoading(true)
    setGenerated(null)
    const res = await fetch('/api/seo/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ website_id: website.id, type: selectedType.key, options }),
    })
    const data = await res.json()
    if (data.content) setGenerated(data.content)
    setLoading(false)
  }

  const loadLibrary = async () => {
    const res = await fetch(`/api/seo/content?website_id=${website.id}`)
    const data = await res.json()
    setContentList(data.content ?? [])
    setView('library')
  }

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/seo/content/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setContentList(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  const copyContent = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getContentText = (content: any): string => {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content
      return JSON.stringify(parsed, null, 2)
    } catch {
      return String(content)
    }
  }

  const renderContent = (content: any) => {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content
      if (parsed.content) return <MarkdownPreview text={parsed.content} />
      if (parsed.posts) return <PostsPreview posts={parsed.posts} />
      if (parsed.emails) return <EmailsPreview emails={parsed.emails} />
      if (parsed.ads) return <AdsPreview ads={parsed.ads} />
      if (parsed.tweets) return <TweetsPreview tweets={parsed.tweets} />
      if (parsed.post) return <div className="prose prose-invert max-w-none text-sm whitespace-pre-wrap">{parsed.post}</div>
      if (parsed.calendar) return <CalendarDataPreview data={parsed} />
      return <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-auto">{JSON.stringify(parsed, null, 2)}</pre>
    } catch {
      return <p className="text-gray-300 text-sm">{String(content)}</p>
    }
  }

  return (
    <div className="space-y-5">
      {/* View toggle */}
      <div className="flex gap-3">
        <button
          onClick={() => setView('generate')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'generate' ? 'bg-[#D4A017] text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
        >
          Generate Content
        </button>
        <button
          onClick={loadLibrary}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'library' ? 'bg-[#D4A017] text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
        >
          Content Library
        </button>
      </div>

      {view === 'generate' && (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left: Controls */}
          <div className="space-y-4">
            {/* Type selector */}
            <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-4">
              <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Content Type</p>
              <div className="space-y-1">
                {CONTENT_TYPES.map(ct => (
                  <button
                    key={ct.key}
                    onClick={() => setSelectedType(ct)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${selectedType.key === ct.key ? 'bg-[#D4A017]/10 text-[#D4A017] border border-[#D4A017]/30' : 'text-gray-300 hover:bg-gray-800'}`}
                  >
                    <ct.icon className={`w-4 h-4 ${ct.color}`} />
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-4 space-y-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Options</p>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Topic / Subject *</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                  placeholder={`Topic for ${selectedType.label.toLowerCase()}...`}
                  value={options.topic}
                  onChange={e => setOptions(o => ({ ...o, topic: e.target.value }))}
                />
              </div>
              {['blog_post', 'google_ad', 'meta_tags'].includes(selectedType.key) && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Target Keyword</label>
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                    placeholder="Primary keyword..."
                    value={options.keyword}
                    onChange={e => setOptions(o => ({ ...o, keyword: e.target.value }))}
                  />
                </div>
              )}
              {['email_newsletter', 'email_sequence', 'google_ad', 'meta_ad'].includes(selectedType.key) && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Goal / Purpose</label>
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                    placeholder="e.g. Generate leads, Nurture borrowers..."
                    value={options.goal}
                    onChange={e => setOptions(o => ({ ...o, goal: e.target.value }))}
                  />
                </div>
              )}
              {selectedType.key === 'meta_tags' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Page Type</label>
                  <select
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    value={options.page_type}
                    onChange={e => setOptions(o => ({ ...o, page_type: e.target.value }))}
                  >
                    {['Homepage', 'Service Page', 'Blog Post', 'Contact Page', 'About Page', 'Landing Page'].map(p => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
              )}
              {selectedType.key === 'content_calendar' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Month</label>
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="e.g. August 2026"
                    value={options.month}
                    onChange={e => setOptions(o => ({ ...o, month: e.target.value }))}
                  />
                </div>
              )}
              <button
                onClick={generate}
                disabled={loading || !options.topic}
                className="w-full bg-[#D4A017] text-black py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 hover:bg-[#e5b01e] flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                {loading ? 'Generating...' : `Generate ${selectedType.label}`}
              </button>
            </div>
          </div>

          {/* Right: Output */}
          <div className="lg:col-span-2">
            {loading && (
              <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-16 text-center h-full flex flex-col items-center justify-center">
                <PlayCircle className="w-12 h-12 text-[#D4A017] animate-pulse mb-4" />
                <p className="text-gray-400">Generating {selectedType.label}...</p>
                <p className="text-xs text-gray-600 mt-1">Usually takes 15-30 seconds</p>
              </div>
            )}

            {generated && !loading && (
              <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 h-full flex flex-col">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
                  <div>
                    <p className="font-semibold text-sm">{generated.title}</p>
                    <Badge status={generated.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyContent(getContentText(generated.content))}
                      className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={() => updateStatus(generated.id, 'approved')}
                      className="flex items-center gap-1.5 text-xs bg-blue-900/50 hover:bg-blue-900 text-blue-300 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Check className="w-3 h-3" /> Approve
                    </button>
                    <button
                      onClick={() => updateStatus(generated.id, 'published')}
                      className="flex items-center gap-1.5 text-xs bg-green-900/50 hover:bg-green-900 text-green-300 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Send className="w-3 h-3" /> Publish
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  {renderContent(generated.parsed || generated.content)}
                </div>
              </div>
            )}

            {!generated && !loading && (
              <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-16 text-center h-full flex flex-col items-center justify-center">
                <selectedType.icon className={`w-12 h-12 ${selectedType.color} mb-4 opacity-50`} />
                <p className="text-gray-500">Select a content type and topic, then generate</p>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'library' && (
        <div className="space-y-3">
          {contentList.length === 0 && (
            <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-12 text-center text-gray-500">
              No content generated yet for this website.
            </div>
          )}
          {contentList.map(item => (
            <ContentLibraryCard key={item.id} item={item} onStatusChange={updateStatus} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Content Library Card ─────────────────────────────────────────────────────

function ContentLibraryCard({ item, onStatusChange }: { item: any; onStatusChange: (id: string, status: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  const typeInfo = CONTENT_TYPES.find(ct => ct.key === item.type)
  const Icon = typeInfo?.icon ?? FileText

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-800/20" onClick={() => setExpanded(e => !e)}>
        <Icon className={`w-5 h-5 ${typeInfo?.color ?? 'text-gray-400'} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{item.title}</p>
          <p className="text-xs text-gray-500">{typeInfo?.label ?? item.type} · {new Date(item.created_at).toLocaleDateString()}</p>
        </div>
        <Badge status={item.status} />
        <div className="flex items-center gap-2 ml-2" onClick={e => e.stopPropagation()}>
          {item.status === 'draft' && (
            <button onClick={() => onStatusChange(item.id, 'approved')} className="text-xs text-blue-400 hover:text-blue-300">Approve</button>
          )}
          {item.status !== 'published' && (
            <button onClick={() => onStatusChange(item.id, 'published')} className="text-xs text-green-400 hover:text-green-300">Publish</button>
          )}
          <button onClick={() => onStatusChange(item.id, 'archived')} className="text-xs text-gray-500 hover:text-gray-400">Archive</button>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </div>
      {expanded && (
        <div className="border-t border-gray-800 p-4">
          <ContentPreviewSimple content={item.content} />
        </div>
      )}
    </div>
  )
}

function ContentPreviewSimple({ content }: { content: string }) {
  try {
    const parsed = JSON.parse(content)
    if (parsed.content) return <MarkdownPreview text={parsed.content} />
    if (parsed.posts) return <PostsPreview posts={parsed.posts} />
    if (parsed.emails) return <EmailsPreview emails={parsed.emails} />
    if (parsed.ads) return <AdsPreview ads={parsed.ads} />
    if (parsed.tweets) return <TweetsPreview tweets={parsed.tweets} />
    if (parsed.post) return <p className="text-sm text-gray-300 whitespace-pre-wrap">{parsed.post}</p>
    return <pre className="text-xs text-gray-400 overflow-auto max-h-60 whitespace-pre-wrap">{JSON.stringify(parsed, null, 2)}</pre>
  } catch {
    return <p className="text-sm text-gray-300">{content}</p>
  }
}

// ─── Content Type Renderers ───────────────────────────────────────────────────

function MarkdownPreview({ text }: { text: string }) {
  return <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">{text}</div>
}

function PostsPreview({ posts }: { posts: any[] }) {
  return (
    <div className="space-y-4">
      {posts.map((post, i) => (
        <div key={i} className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Variation {i + 1}</span>
            {post.post_type && <Badge status={post.post_type} />}
          </div>
          <p className="text-sm text-gray-200 whitespace-pre-wrap">{post.caption || post.text}</p>
          {post.hashtags && <p className="text-xs text-blue-400 mt-2">{post.hashtags.join(' ')}</p>}
          {post.cta && <p className="text-xs text-[#D4A017] mt-1">CTA: {post.cta}</p>}
        </div>
      ))}
    </div>
  )
}

function TweetsPreview({ tweets }: { tweets: any[] }) {
  return (
    <div className="space-y-3">
      {tweets.map((t, i) => (
        <div key={i} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <Badge status={t.type} />
            <span className="text-xs text-gray-500">{t.text?.length ?? 0}/280 chars</span>
          </div>
          <p className="text-sm text-gray-200">{t.text}</p>
        </div>
      ))}
    </div>
  )
}

function EmailsPreview({ emails }: { emails: any[] }) {
  return (
    <div className="space-y-4">
      {emails.map((email, i) => (
        <div key={i} className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#D4A017]/20 text-[#D4A017] text-xs px-2.5 py-0.5 rounded-full font-medium">Day {email.day}</span>
            <p className="text-sm font-semibold text-white">{email.subject}</p>
          </div>
          {email.preview && <p className="text-xs text-gray-400 mb-2 italic">Preview: {email.preview}</p>}
          <p className="text-sm text-gray-300 whitespace-pre-wrap max-h-32 overflow-y-auto">{email.body}</p>
          {email.cta && <p className="text-xs text-[#D4A017] mt-2 font-medium">CTA: {email.cta}</p>}
        </div>
      ))}
    </div>
  )
}

function AdsPreview({ ads }: { ads: any[] }) {
  return (
    <div className="space-y-4">
      {ads.map((ad, i) => (
        <div key={i} className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-3">Ad {i + 1}{ad.format ? ` — ${ad.format}` : ''}</p>
          {ad.headlines && (
            <div className="mb-2">
              <p className="text-xs text-gray-500 mb-1">Headlines</p>
              {ad.headlines.map((h: string, j: number) => <p key={j} className="text-sm font-semibold text-blue-300">{h}</p>)}
            </div>
          )}
          {ad.descriptions && (
            <div className="mb-2">
              <p className="text-xs text-gray-500 mb-1">Descriptions</p>
              {ad.descriptions.map((d: string, j: number) => <p key={j} className="text-sm text-gray-300">{d}</p>)}
            </div>
          )}
          {ad.primary_text && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Primary Text</p>
              <p className="text-sm text-gray-300">{ad.primary_text}</p>
            </div>
          )}
          {ad.headline && <p className="text-sm font-semibold text-blue-300 mt-1">{ad.headline}</p>}
          {ad.cta_button && <p className="text-xs text-[#D4A017] mt-2">CTA: {ad.cta_button}</p>}
        </div>
      ))}
    </div>
  )
}

function CalendarDataPreview({ data }: { data: any }) {
  const byChannel = (data.calendar || []).reduce((acc: any, item: any) => {
    acc[item.channel] = acc[item.channel] || []
    acc[item.channel].push(item)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {data.strategy_summary && <p className="text-sm text-gray-400 italic">{data.strategy_summary}</p>}
      {Object.entries(byChannel).map(([channel, items]: [string, any]) => (
        <div key={channel}>
          <h4 className="text-sm font-semibold text-[#D4A017] mb-2 capitalize">{channel}</h4>
          <div className="space-y-1">
            {items.slice(0, 5).map((item: any, i: number) => (
              <div key={i} className="flex items-start gap-3 text-xs text-gray-400">
                <span className="text-gray-600 flex-shrink-0">{item.date}</span>
                <span className="text-gray-300">{item.topic}</span>
              </div>
            ))}
            {items.length > 5 && <p className="text-xs text-gray-600">+{items.length - 5} more posts</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

function CalendarTab({ website }: { website: Website }) {
  const [content, setContent] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState('all')

  const load = async () => {
    const res = await fetch(`/api/seo/content?website_id=${website.id}`)
    const data = await res.json()
    setContent(data.content ?? [])
    setLoaded(true)
  }

  if (!loaded) {
    return (
      <div className="text-center py-16">
        <button onClick={load} className="bg-[#D4A017] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#e5b01e]">
          Load Content Calendar
        </button>
      </div>
    )
  }

  const CHANNELS = ['all', 'blog_post', 'social_instagram', 'social_facebook', 'social_linkedin', 'social_twitter', 'email_newsletter', 'google_ad', 'meta_ad']
  const filtered = filter === 'all' ? content : content.filter(c => c.type === filter)

  const byStatus = {
    draft: filtered.filter(c => c.status === 'draft'),
    approved: filtered.filter(c => c.status === 'approved'),
    published: filtered.filter(c => c.status === 'published'),
    archived: filtered.filter(c => c.status === 'archived'),
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Content Calendar</h2>
        <button onClick={load} className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Channel filter */}
      <div className="flex gap-2 flex-wrap">
        {CHANNELS.map(ch => {
          const label = ch === 'all' ? `All (${content.length})` : `${CONTENT_TYPES.find(ct => ct.key === ch)?.label ?? ch} (${content.filter(c => c.type === ch).length})`
          return (
            <button
              key={ch}
              onClick={() => setFilter(ch)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === ch ? 'bg-[#D4A017] text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(byStatus).map(([status, items]) => (
          <div key={status} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase">{status}</span>
              <span className="bg-gray-800 text-gray-400 text-xs rounded-full w-5 h-5 flex items-center justify-center">{items.length}</span>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {items.map(item => {
                const typeInfo = CONTENT_TYPES.find(ct => ct.key === item.type)
                const Icon = typeInfo?.icon ?? FileText
                return (
                  <div key={item.id} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-3 h-3 ${typeInfo?.color ?? 'text-gray-400'}`} />
                      <span className="text-xs text-gray-500">{typeInfo?.label ?? item.type}</span>
                    </div>
                    <p className="text-xs text-gray-200 font-medium leading-tight">{item.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{new Date(item.created_at).toLocaleDateString()}</p>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Competitors Tab ──────────────────────────────────────────────────────────

function CompetitorsTab({ website }: { website: Website }) {
  const [competitorUrl, setCompetitorUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const analyze = async () => {
    if (!competitorUrl.trim()) return
    setLoading(true)
    setAnalysis(null)
    const res = await fetch('/api/seo/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ website_id: website.id, competitor_url: competitorUrl }),
    })
    const data = await res.json()
    if (data.analysis) setAnalysis(data.analysis)
    setLoading(false)
  }

  const toggle = (key: string) => setExpanded(e => ({ ...e, [key]: !e[key] }))

  const threatColors: Record<string, string> = {
    high: 'text-red-400 bg-red-950/50 border-red-900/50',
    medium: 'text-yellow-400 bg-yellow-950/50 border-yellow-900/50',
    low: 'text-green-400 bg-green-950/50 border-green-900/50',
  }

  // Pre-populate from website.competitors
  const suggestions = website.competitors?.filter(c => c) ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <input
            className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-[#D4A017] outline-none"
            placeholder="https://competitor.com"
            value={competitorUrl}
            onChange={e => setCompetitorUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && analyze()}
          />
          {suggestions.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="text-xs text-gray-500">Quick add:</span>
              {suggestions.map(s => (
                <button key={s} onClick={() => setCompetitorUrl(s)} className="text-xs text-[#D4A017] hover:underline">{s}</button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={analyze}
          disabled={loading || !competitorUrl}
          className="bg-[#D4A017] text-black px-6 py-3 rounded-lg font-semibold text-sm disabled:opacity-50 hover:bg-[#e5b01e] flex items-center gap-2 whitespace-nowrap"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Users2 className="w-4 h-4" />}
          {loading ? 'Analyzing...' : 'Analyze Competitor'}
        </button>
      </div>

      {loading && (
        <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-12 text-center">
          <Users2 className="w-10 h-10 text-[#D4A017] animate-pulse mx-auto mb-4" />
          <p className="text-gray-400">Crawling competitor and running AI analysis...</p>
        </div>
      )}

      {analysis && (
        <div className="space-y-4">
          {/* Header */}
          <div className={`rounded-xl border p-5 ${threatColors[analysis.overall_threat_level] ?? 'bg-gray-800 border-gray-700 text-white'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xl font-bold">{analysis.competitor_name}</h3>
                <a href={analysis.competitor_url} target="_blank" rel="noopener noreferrer" className="text-sm opacity-70 flex items-center gap-1">
                  {analysis.competitor_url} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-60 mb-1">Threat Level</p>
                <p className="text-2xl font-bold uppercase">{analysis.overall_threat_level}</p>
              </div>
            </div>
            <p className="text-sm opacity-80">{analysis.executive_summary}</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Est. Traffic', value: analysis.estimated_traffic },
              { label: 'Content Strategy', value: analysis.content_strategy?.slice(0, 60) + '...' },
              { label: 'Backlinks', value: analysis.backlink_profile?.slice(0, 60) + '...' },
            ].map(item => (
              <div key={item.label} className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                <p className="text-sm text-gray-200">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid md:grid-cols-2 gap-4">
            <CollapsibleSection title={`Their Strengths (${analysis.strengths_vs_us?.length ?? 0})`} open={expanded['str']} onToggle={() => toggle('str')}>
              <div className="space-y-3">
                {(analysis.strengths_vs_us || []).map((item: any, i: number) => (
                  <div key={i} className="p-3 bg-red-950/20 rounded-lg border border-red-900/20">
                    <p className="text-sm font-semibold text-red-300">{item.area}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                    <p className="text-xs text-[#D4A017] mt-1">Our response: {item.our_response}</p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title={`Their Weaknesses (${analysis.weaknesses_vs_us?.length ?? 0})`} open={expanded['weak']} onToggle={() => toggle('weak')}>
              <div className="space-y-3">
                {(analysis.weaknesses_vs_us || []).map((item: any, i: number) => (
                  <div key={i} className="p-3 bg-green-950/20 rounded-lg border border-green-900/20">
                    <p className="text-sm font-semibold text-green-300">{item.area}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                    <p className="text-xs text-[#D4A017] mt-1">Opportunity: {item.opportunity}</p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          </div>

          {/* Keyword Gaps */}
          <CollapsibleSection title={`Keyword Gaps (${analysis.keyword_gaps?.length ?? 0})`} open={expanded['kwgap']} onToggle={() => toggle('kwgap')}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                    <th className="pb-2 pr-4">Keyword</th>
                    <th className="pb-2 pr-4">Their Rank</th>
                    <th className="pb-2 pr-4">Difficulty</th>
                    <th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {(analysis.keyword_gaps || []).map((kw: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 font-medium">{kw.keyword}</td>
                      <td className="py-2 pr-4 text-gray-400">{kw.competitor_likely_rank}</td>
                      <td className="py-2 pr-4"><Badge status={kw.difficulty} /></td>
                      <td className="py-2 text-xs text-gray-400">{kw.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>

          {/* Quick Wins */}
          <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-[#D4A017]" /> Quick Wins to Beat Them</h3>
            <div className="space-y-2">
              {(analysis.quick_wins || []).map((win: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <ArrowRight className="w-4 h-4 text-[#D4A017] mt-0.5 flex-shrink-0" />
                  {win}
                </div>
              ))}
            </div>
          </div>

          {/* Differentiation */}
          {analysis.differentiation_opportunities?.length > 0 && (
            <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-3"><Award className="w-4 h-4 text-purple-400" /> Differentiation Opportunities</h3>
              <div className="space-y-2">
                {analysis.differentiation_opportunities.map((opp: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <div className="w-5 h-5 rounded-full bg-purple-900/50 text-purple-300 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                    {opp}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function CollapsibleSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden">
      <button className="w-full flex items-center justify-between px-5 py-4 text-left" onClick={onToggle}>
        <span className="font-semibold text-sm">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}

function StatusDot({ status }: { status?: string }) {
  const colors: Record<string, string> = {
    good: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500',
  }
  return <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${colors[status ?? ''] ?? 'bg-gray-500'}`} />
}

function DifficultyBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0))
  const color = pct < 35 ? 'bg-green-500' : pct < 65 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400">{pct}</span>
    </div>
  )
}
