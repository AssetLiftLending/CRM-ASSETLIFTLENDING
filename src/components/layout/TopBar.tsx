'use client'

import { useState } from 'react'
import { Search, Bell, Plus } from 'lucide-react'
import Link from 'next/link'

interface Profile { full_name?: string; role?: string }

export default function TopBar({ profile }: { profile: Profile | null }) {
  const [search, setSearch] = useState('')

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center gap-4 px-6 flex-shrink-0">
      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts, deals, notes…"
          className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2
                     text-sm focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500"
        />
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Quick Add */}
        <Link
          href="/contacts?new=1"
          className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-dark-800
                     font-semibold text-sm px-4 py-2 rounded-xl transition-base"
        >
          <Plus size={15} />
          New Lead
        </Link>

        {/* Notifications */}
        <button className="relative p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-base">
          <Bell size={18} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-gold-500 rounded-full" />
        </button>
      </div>
    </header>
  )
}
