import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PortalDashboard from '@/components/portal/PortalDashboard'

export default async function PortalPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/portal/login')

  // Get borrower's contact + deals + documents
  const { data: contact } = await supabase
    .from('contacts')
    .select('*, deals(*, documents(*))')
    .eq('email', user.email)
    .single()

  if (!contact) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md">
          <div className="text-4xl mb-3">🔍</div>
          <h2 className="text-xl font-bold text-dark-800 mb-2">Account Not Found</h2>
          <p className="text-gray-500 text-sm">
            We couldn't find an account linked to <strong>{user.email}</strong>.
            Please contact Asset Lift Lending to verify your email address.
          </p>
        </div>
      </div>
    )
  }

  return <PortalDashboard contact={contact} />
}
