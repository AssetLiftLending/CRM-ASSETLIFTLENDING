import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SEOHubClient from '@/components/seo/SEOHubClient'

export const metadata = { title: 'SEO & Marketing Hub' }

export default async function SEOHubPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: websites } = await admin
    .from('websites')
    .select('*, seo_audits(id, score, status, created_at), generated_content(id, type, status)')
    .order('created_at', { ascending: false })

  return <SEOHubClient initialWebsites={websites ?? []} />
}
