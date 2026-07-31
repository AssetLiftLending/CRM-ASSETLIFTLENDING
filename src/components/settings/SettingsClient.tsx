'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Phone, Save, User, Users, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import UserManagementClient from '@/components/admin/UserManagementClient'

type Profile = Record<string, any>
type Template = Record<string, any>
type Automation = Record<string, any>

const TABS = ['Profile', 'Team', 'Phone & SMS', 'Email', 'Automations'] as const
type Tab = typeof TABS[number]

interface Props {
  profile: Profile | null
  profiles: Profile[]
  smsTemplates: Template[]
  emailTemplates: Template[]
  automations: Automation[]
  initialTab?: Tab
}

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  Profile: <User size={14} />,
  Team: <Users size={14} />,
  'Phone & SMS': <Phone size={14} />,
  Email: <Mail size={14} />,
  Automations: <Zap size={14} />,
}

export default function SettingsClient({
  profile,
  smsTemplates,
  emailTemplates,
  automations,
  initialTab,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(initialTab ?? 'Profile')
  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function saveProfile() {
    setSaving(true)
    const res = await fetch('/api/settings/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileForm),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Profile saved')
      router.refresh()
    } else {
      toast.error('Save failed')
    }
  }

  async function toggleAutomation(id: string, current: boolean) {
    await fetch(`/api/automations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    })
    router.refresh()
    toast.success(!current ? 'Automation enabled' : 'Automation disabled')
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-dark-800">Settings</h1>
        <p className="text-gray-500 text-sm">Manage your account, team, users, passwords, and integrations</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-base
              ${tab === t ? 'bg-white text-dark-800 shadow-sm' : 'text-gray-500 hover:text-dark-700'}`}>
            {TAB_ICONS[t]} {t}
          </button>
        ))}
      </div>

      {tab === 'Profile' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="font-bold text-dark-800">My Profile</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Full Name</label>
              <input value={profileForm.full_name} onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Phone</label>
              <input value={profileForm.phone} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500" />
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <strong>Email:</strong> {profile?.email ?? '-'} &nbsp;|&nbsp; <strong>Role:</strong> {profile?.role ?? '-'}
          </div>
          <button onClick={saveProfile} disabled={saving}
            className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800 font-bold px-5 py-2.5 rounded-xl text-sm">
            <Save size={14} /> {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      )}

      {tab === 'Team' && <UserManagementClient compact />}

      {tab === 'Phone & SMS' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-dark-800 mb-4">Twilio Phone Configuration</h2>
            <div className="space-y-3">
              {[
                { label: 'Business Phone Number', env: 'TWILIO_PHONE_NUMBER', desc: 'Your main business number in Twilio' },
                { label: 'Cell Forwarding Number', env: 'TWILIO_CELL_NUMBER', desc: 'Calls forward here when you are away from the CRM' },
                { label: 'WhatsApp Number', env: 'TWILIO_WHATSAPP_NUMBER', desc: 'Twilio WhatsApp-enabled number, formatted like whatsapp:+1...' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <Phone size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-dark-800">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                    <code className="text-xs bg-gray-200 px-1.5 py-0.5 rounded mt-1 inline-block">{item.env}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-dark-800">SMS Templates ({smsTemplates.length})</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {smsTemplates.map(t => (
                <div key={t.id} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-dark-800">{t.name}</p>
                    <span className="text-xs text-gray-400">{t.category}</span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono bg-gray-50 rounded p-2 mt-1">{t.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'Email' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-dark-800 mb-4">SendGrid Configuration</h2>
            <div className="space-y-3">
              {[
                { label: 'SendGrid API Key', env: 'SENDGRID_API_KEY' },
                { label: 'From Email', env: 'SENDGRID_FROM_EMAIL' },
                { label: 'From Name', env: 'SENDGRID_FROM_NAME' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <Mail size={16} className="text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-dark-800">{item.label}</p>
                    <code className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{item.env}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-dark-800">Email Templates ({emailTemplates.length})</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {emailTemplates.map(t => (
                <div key={t.id} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-dark-800">{t.name}</p>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t.category}</span>
                  </div>
                  <p className="text-xs font-medium text-gray-500">Subject: {t.subject}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'Automations' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-bold text-dark-800">Automation Rules</h2>
            <p className="text-sm text-gray-400 mt-0.5">Toggle automations on or off.</p>
          </div>
          <div className="divide-y divide-gray-50">
            {automations.map(a => (
              <div key={a.id} className="flex items-center gap-4 p-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                  ${a.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  <Zap size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-dark-800">{a.name}</p>
                  <p className="text-xs text-gray-400">Trigger: {a.trigger_type?.replace(/_/g, ' ')}</p>
                  {a.description && <p className="text-xs text-gray-400">{a.description}</p>}
                </div>
                <button onClick={() => toggleAutomation(a.id, a.is_active)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                    ${a.is_active ? 'bg-gold-500' : 'bg-gray-200'}`}>
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                    ${a.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
