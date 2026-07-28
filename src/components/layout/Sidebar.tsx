'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, KanbanSquare, CheckSquare,
  MessageSquare, Calendar, BarChart2, Sparkles,
  Settings, LogOut, Phone, Mail, Megaphone, Import, Globe,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { fmt } from '@/lib/utils/format'

const NAV = [
  { href: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/contacts',        icon: Users,           label: 'Contacts' },
  { href: '/pipeline',        icon: KanbanSquare,    label: 'Pipeline' },
  { href: '/tasks',           icon: CheckSquare,     label: 'Tasks' },
  { href: '/communications',  icon: MessageSquare,   label: 'Communications' },
  { href: '/calendar',        icon: Calendar,        label: 'Calendar' },
  { href: '/reports',         icon: BarChart2,       label: 'Reports' },
  { href: '/ai',              icon: Sparkles,        label: 'AI Tools' },
  { href: '/seo',             icon: Globe,           label: 'SEO & Marketing' },
]

const BOTTOM_NAV = [
  { href: '/admin',          icon: Import,   label: 'Import / Admin' },
  { href: '/admin/brokers',  icon: Users,    label: 'Broker Partners' },
  { href: '/settings',       icon: Settings, label: 'Settings' },
]

interface Profile { full_name?: string; email?: string; role?: string; avatar_url?: string }

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <aside className="w-60 bg-dark-800 flex flex-col border-r border-dark-600 flex-shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-dark-600">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-dark-800 font-black text-sm">AL</span>
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">Asset Lift</div>
            <div className="text-gold-500 font-bold text-sm leading-tight">Lending CRM</div>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-base
              ${isActive(href)
                ? 'bg-gold-500 text-dark-800'
                : 'text-gray-400 hover:text-white hover:bg-dark-600'}`}
          >
            <Icon size={17} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Bottom Nav */}
      <div className="p-3 border-t border-dark-600 space-y-0.5">
        {BOTTOM_NAV.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-base
              ${isActive(href)
                ? 'bg-gold-500 text-dark-800'
                : 'text-gray-400 hover:text-white hover:bg-dark-600'}`}
          >
            <Icon size={17} />
            {label}
          </Link>
        ))}

        {/* Profile */}
        <div className="mt-2 pt-3 border-t border-dark-600">
          <div className="flex items-center gap-2 px-2 mb-2">
            <div className="w-8 h-8 bg-gold-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-dark-800 font-bold text-xs">
                {fmt.initials(profile?.full_name?.split(' ')[0], profile?.full_name?.split(' ')[1])}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-white text-xs font-semibold truncate">{profile?.full_name ?? 'User'}</div>
              <div className="text-gray-500 text-xs capitalize">{profile?.role?.replace('_', ' ') ?? 'Staff'}</div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-400
                       hover:text-red-400 hover:bg-dark-600 transition-base"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  )
}
