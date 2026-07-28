import { createServerClient } from '@/lib/supabase/server'
import SettingsClient from '@/components/settings/SettingsClient'

export default async function SettingsPage() {
  const supabase = createServerClient()

  const [{ data: profile }, { data: profiles }, { data: smsTemplates }, { data: emailTemplates }, { data: automations }] =
    await Promise.all([
      supabase.from('profiles').select('*').single(),
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('sms_templates').select('*').order('name'),
      supabase.from('email_templates').select('*').order('name'),
      supabase.from('automations').select('*').order('name'),
    ])

  return (
    <SettingsClient
      profile={profile}
      profiles={profiles ?? []}
      smsTemplates={smsTemplates ?? []}
      emailTemplates={emailTemplates ?? []}
      automations={automations ?? []}
    />
  )
}
