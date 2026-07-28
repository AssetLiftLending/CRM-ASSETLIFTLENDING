export const fmt = {
  currency: (n?: number | null) =>
    n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n),

  pct: (n?: number | null, decimals = 1) =>
    n == null ? '—' : `${n.toFixed(decimals)}%`,

  phone: (p?: string | null) => {
    if (!p) return '—'
    const d = p.replace(/\D/g, '')
    if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
    if (d.length === 11) return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`
    return p
  },

  date: (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',

  dateTime: (d?: string | null) =>
    d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—',

  relativeTime: (d?: string | null) => {
    if (!d) return '—'
    const diff = Date.now() - new Date(d).getTime()
    const mins  = Math.floor(diff / 60000)
    const hours = Math.floor(mins / 60)
    const days  = Math.floor(hours / 24)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 30) return `${days}d ago`
    return fmt.date(d)
  },

  name: (first?: string, last?: string) =>
    [first, last].filter(Boolean).join(' ') || 'Unknown',

  initials: (first?: string, last?: string) =>
    [(first?.[0] ?? ''), (last?.[0] ?? '')].join('').toUpperCase() || '?',

  loanProgram: (p?: string) => {
    const map: Record<string, string> = {
      fix_flip: 'Fix & Flip', dscr: 'DSCR', ground_up: 'Ground-Up',
      commercial: 'Commercial', multifamily: 'Multifamily', custom: 'Custom',
    }
    return p ? (map[p] ?? p) : '—'
  },

  stage: (s?: string) => {
    const map: Record<string, string> = {
      new_inquiry: 'New Inquiry', contacted: 'Contacted',
      just_searching: 'Just Searching', dead_lead: 'Dead Lead',
      in_progress: 'In Progress', funded: 'Funded',
    }
    return s ? (map[s] ?? s) : '—'
  },

  callDuration: (secs?: number | null) => {
    if (!secs) return '—'
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, '0')}`
  },
}

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

export const STAGE_COLORS: Record<string, string> = {
  new_inquiry:    'bg-blue-100 text-blue-700',
  contacted:      'bg-purple-100 text-purple-700',
  just_searching: 'bg-yellow-100 text-yellow-700',
  dead_lead:      'bg-red-100 text-red-700',
  in_progress:    'bg-gold-100 text-gold-700',
  funded:         'bg-green-100 text-green-700',
}

export const PRIORITY_COLORS: Record<string, string> = {
  low:    'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-600',
  high:   'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
}
