import { createServerClient } from '@/lib/supabase/server'
import { fmt } from '@/lib/utils/format'
import Link from 'next/link'
import {
  TrendingUp, Users, DollarSign, CheckSquare,
  Phone, ArrowRight, AlertCircle, Star
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  // Fetch summary stats in parallel
  const [
    { count: totalContacts },
    { count: newLeads },
    { count: inProgress },
    { count: fundedThisMonth },
    { data: recentContacts },
    { data: overdueTasks },
    { data: todaysTasks },
    { data: recentComms },
  ] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('deals').select('*', { count: 'exact', head: true }).in('stage', ['new_lead', 'new_inquiry']),
    supabase.from('deals').select('*', { count: 'exact', head: true }).eq('stage', 'in_progress'),
    supabase.from('deals').select('*', { count: 'exact', head: true })
      .in('stage', ['closed_deal', 'funded'])
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from('contacts').select('id,first_name,last_name,phone,lead_source,created_at')
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('tasks').select('id,title,due_date,priority,contact_id')
      .eq('status', 'pending').lt('due_date', new Date().toISOString()).limit(5),
    supabase.from('tasks').select('id,title,due_date,priority,status')
      .eq('status', 'pending')
      .gte('due_date', new Date().toISOString().split('T')[0])
      .lt('due_date', new Date(Date.now() + 86400000).toISOString().split('T')[0])
      .limit(8),
    supabase.from('communications').select('id,type,direction,body,created_at,contact_id')
      .order('created_at', { ascending: false }).limit(6),
  ])

  const stats = [
    { label: 'Total Contacts', value: totalContacts ?? 0, icon: Users, color: 'bg-blue-50 text-blue-600', delta: '+12 this week' },
    { label: 'New Inquiries', value: newLeads ?? 0, icon: TrendingUp, color: 'bg-gold-50 text-gold-600', delta: 'Needs response' },
    { label: 'Deals In Progress', value: inProgress ?? 0, icon: AlertCircle, color: 'bg-purple-50 text-purple-600', delta: 'Active files' },
    { label: 'Funded This Month', value: fundedThisMonth ?? 0, icon: DollarSign, color: 'bg-green-50 text-green-600', delta: '🎉 Funded' },
  ]

  const commTypeIcon: Record<string, string> = {
    call: '📞', sms: '💬', email: '📧', whatsapp: '🟢', note: '📝',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-800">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">{fmt.date(new Date().toISOString())} — Good morning 👋</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon size={18} />
              </div>
            </div>
            <div className="text-3xl font-black text-dark-800 mb-1">{s.value}</div>
            <div className="text-sm font-medium text-gray-700">{s.label}</div>
            <div className="text-xs text-gray-400 mt-1">{s.delta}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Recent Leads */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="font-bold text-dark-800">Recent Leads</h2>
            <Link href="/contacts" className="text-xs text-gold-600 font-medium flex items-center gap-1 hover:underline">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {(recentContacts ?? []).map((c) => (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-base"
              >
                <div className="w-9 h-9 bg-gold-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-gold-700 font-bold text-xs">
                    {fmt.initials(c.first_name, c.last_name)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-dark-800">
                    {fmt.name(c.first_name, c.last_name)}
                  </div>
                  <div className="text-xs text-gray-400">{fmt.phone(c.phone)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs bg-gold-100 text-gold-700 px-2 py-0.5 rounded-full font-medium">
                    {c.lead_source?.replace('_', ' ') ?? 'Direct'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{fmt.relativeTime(c.created_at)}</div>
                </div>
              </Link>
            ))}
            {!recentContacts?.length && (
              <div className="text-center py-8 text-gray-400 text-sm">No contacts yet — import from GHL or add your first lead</div>
            )}
          </div>
        </div>

        {/* Tasks & Activity */}
        <div className="space-y-5">
          {/* Overdue Tasks */}
          {(overdueTasks?.length ?? 0) > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={16} className="text-red-500" />
                <span className="text-sm font-bold text-red-700">Overdue ({overdueTasks?.length})</span>
              </div>
              {overdueTasks?.map((t) => (
                <Link key={t.id} href="/tasks"
                  className="block text-xs text-red-700 py-1.5 border-b border-red-100 last:border-0 hover:underline truncate">
                  {t.title}
                </Link>
              ))}
            </div>
          )}

          {/* Today's Tasks */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-dark-800 text-sm flex items-center gap-2">
                <CheckSquare size={15} className="text-gold-500" /> Today&apos;s Tasks
              </h3>
              <Link href="/tasks" className="text-xs text-gold-600 hover:underline">View all</Link>
            </div>
            <div className="p-2">
              {todaysTasks?.map((t) => (
                <div key={t.id} className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded-lg">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    t.priority === 'urgent' ? 'bg-red-500' :
                    t.priority === 'high' ? 'bg-orange-400' :
                    t.priority === 'medium' ? 'bg-gold-500' : 'bg-gray-300'
                  }`} />
                  <span className="text-xs text-dark-800 truncate">{t.title}</span>
                </div>
              ))}
              {!todaysTasks?.length && (
                <div className="text-center py-4 text-xs text-gray-400">No tasks due today 🎉</div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-dark-800 rounded-2xl p-4 space-y-2">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</div>
            <Link href="/contacts?new=1"
              className="flex items-center gap-2 text-sm text-white hover:text-gold-400 transition-base py-1">
              <Users size={13} className="text-gold-500" /> Add New Lead
            </Link>
            <Link href="/communications?tab=call"
              className="flex items-center gap-2 text-sm text-white hover:text-gold-400 transition-base py-1">
              <Phone size={13} className="text-gold-500" /> Make a Call
            </Link>
            <Link href="/ai"
              className="flex items-center gap-2 text-sm text-white hover:text-gold-400 transition-base py-1">
              <Star size={13} className="text-gold-500" /> AI Follow-Up Coach
            </Link>
            <Link href="/ai?tab=ads"
              className="flex items-center gap-2 text-sm text-white hover:text-gold-400 transition-base py-1">
              <TrendingUp size={13} className="text-gold-500" /> Create Ad
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Communications */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-dark-800">Recent Activity</h2>
          <Link href="/communications" className="text-xs text-gold-600 font-medium flex items-center gap-1 hover:underline">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {(recentComms ?? []).map((c) => (
            <div key={c.id} className="flex items-start gap-4 px-5 py-3">
              <span className="text-lg mt-0.5">{commTypeIcon[c.type] ?? '💬'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-dark-800 truncate">{c.body ?? '(call)'}</div>
                <div className="text-xs text-gray-400 mt-0.5">{fmt.relativeTime(c.created_at)}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                c.direction === 'inbound' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {c.direction ?? 'out'}
              </span>
            </div>
          ))}
          {!recentComms?.length && (
            <div className="text-center py-8 text-gray-400 text-sm">No activity yet</div>
          )}
        </div>
      </div>
    </div>
  )
}
