import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import BrokerDashboard from '@/components/broker/BrokerDashboard'

export default async function BrokerPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/broker/login')

  const admin = createAdminClient()

  // Verify broker + approved
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email, role, approved, company_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'broker') redirect('/broker/login')
  if (!profile.approved) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-white font-bold text-xl mb-2">Account Pending Approval</h2>
          <p className="text-gray-400 mb-4">Your broker account is being reviewed. We'll email you at {profile.email} once approved.</p>
          <p className="text-gray-600 text-sm">Questions? Email <a href="mailto:info@assetliftlending.com" className="text-[#D4A017]">info@assetliftlending.com</a></p>
        </div>
      </div>
    )
  }

  // Fetch broker's deals
  const { data: deals } = await admin
    .from('deals')
    .select(`
      *,
      contacts (id, first_name, last_name, email, phone),
      documents (id, doc_type, status, file_name, file_url, uploaded_by, uploaded_at, created_at)
    `)
    .eq('broker_id', user.id)
    .order('created_at', { ascending: false })

  return <BrokerDashboard profile={profile} initialDeals={deals ?? []} />
}
