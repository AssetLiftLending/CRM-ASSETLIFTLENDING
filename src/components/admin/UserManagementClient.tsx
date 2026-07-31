'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLE_OPTIONS = [
  { value: 'loan_officer', label: 'Loan Officer' },
  { value: 'processor', label: 'Processor' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'read_only', label: 'Read Only' },
  { value: 'broker', label: 'Broker' },
  { value: 'borrower', label: 'Borrower' },
  { value: 'organization_admin', label: 'Organization Admin' },
  { value: 'platform_admin', label: 'Platform Admin' },
]

type UserRow = {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  role: string
  is_active: boolean
  approved: boolean | null
  created_at: string
}

export default function UserManagementClient({ compact = false }: { compact?: boolean }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [passwords, setPasswords] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'loan_officer',
  })

  async function loadUsers() {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      toast.error(data.error ?? 'Failed to load users')
      return
    }

    setUsers(data.users ?? [])
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function createUser() {
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error('Name, email, and password are required')
      return
    }

    setCreating(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setCreating(false)

    if (!res.ok) {
      toast.error(data.error ?? 'User creation failed')
      return
    }

    toast.success('User created. They can log in with the password you set.')
    setForm({ full_name: '', email: '', phone: '', password: '', role: 'loan_officer' })
    await loadUsers()
  }

  async function setPassword(userId: string) {
    const password = passwords[userId]?.trim()
    if (!password) {
      toast.error('Enter a new password first')
      return
    }

    setUpdatingId(userId)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, password }),
    })
    const data = await res.json()
    setUpdatingId(null)

    if (!res.ok) {
      toast.error(data.error ?? 'Password update failed')
      return
    }

    setPasswords((current) => ({ ...current, [userId]: '' }))
    toast.success('Password updated')
  }

  return (
    <div className={`space-y-6 ${compact ? '' : 'max-w-5xl'}`}>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="font-bold text-dark-800">Create User</h2>
          <p className="text-xs text-gray-500 mt-1">
            Create CRM staff, organization admins, platform admins, brokers, or borrowers with a password directly from the portal.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
            placeholder="Full name"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500" />
          <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="Email"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500" />
          <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            placeholder="Phone"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500" />
          <input value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            placeholder="Password"
            type="password"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500" />
          <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500">
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button onClick={createUser} disabled={creating}
            className="flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800 font-bold px-4 py-2 rounded-xl text-sm">
            <UserPlus size={15} /> {creating ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-dark-800">Users</h2>
          <button onClick={loadUsers}
            className="flex items-center gap-2 text-sm text-gold-600 hover:text-gold-700 font-medium">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {loading ? (
            <div className="p-6 text-sm text-gray-400">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="p-6 text-sm text-gray-400">No users found.</div>
          ) : users.map(user => (
            <div key={user.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gold-100 flex items-center justify-center text-gold-700 font-bold text-sm">
                  {user.full_name?.charAt(0) ?? user.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dark-800 truncate">{user.full_name ?? 'No name'}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-600">
                  {user.role?.replace(/_/g, ' ')}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={passwords[user.id] ?? ''}
                  onChange={e => setPasswords((current) => ({ ...current, [user.id]: e.target.value }))}
                  type="password"
                  placeholder="New password"
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                />
                <button onClick={() => setPassword(user.id)} disabled={updatingId === user.id}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:border-gold-400 hover:text-gold-700 disabled:opacity-50">
                  <ShieldCheck size={14} /> {updatingId === user.id ? 'Saving...' : 'Set Password'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
