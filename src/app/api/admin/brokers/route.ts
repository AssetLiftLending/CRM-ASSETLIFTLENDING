import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/sendgrid/client'

const ADMIN_ROLES = ['platform_admin', 'organization_admin', 'owner']

// GET — list all broker profiles
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !ADMIN_ROLES.includes(me.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: brokers } = await admin
    .from('profiles')
    .select('id, full_name, email, phone, company_name, license_number, approved, approved_at, created_at')
    .eq('role', 'broker')
    .order('created_at', { ascending: false })

  // Get deal counts per broker
  const brokerIds = (brokers ?? []).map(b => b.id)
  const { data: dealCounts } = await admin
    .from('deals')
    .select('broker_id')
    .in('broker_id', brokerIds)

  const countMap = (dealCounts ?? []).reduce((acc: Record<string, number>, d) => {
    if (d.broker_id) acc[d.broker_id] = (acc[d.broker_id] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    brokers: (brokers ?? []).map(b => ({ ...b, deal_count: countMap[b.id] ?? 0 })),
  })
}

// PATCH — approve or deactivate a broker
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !ADMIN_ROLES.includes(me.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { broker_id, action } = await req.json()

  if (action === 'approve') {
    await admin.from('profiles').update({ approved: true, approved_at: new Date().toISOString() }).eq('id', broker_id)

    // Confirm their email in auth
    await admin.auth.admin.updateUserById(broker_id, { email_confirm: true })

    // Get broker info for email
    const { data: broker } = await admin.from('profiles').select('email, full_name, company_name').eq('id', broker_id).single()
    if (broker) {
      try {
        await sendEmail({
          to: broker.email,
          subject: 'Your Broker Account Has Been Approved — Asset Lift Lending',
          html: `
            <h2>Welcome, ${broker.full_name}!</h2>
            <p>Your broker partner account with Asset Lift Lending has been approved.</p>
            <p>You can now log in to your broker portal to submit deals and track your clients:</p>
            <a href="https://assetliftlending.com/broker/login" style="background:#D4A017;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Access Broker Portal →</a>
            <p style="margin-top:20px">Questions? Email us at info@assetliftlending.com</p>
            <p>Asset Lift Lending Team</p>
          `,
        })
      } catch (e) {
        console.error('Approval email failed:', e)
      }
    }
  } else if (action === 'deactivate') {
    await admin.from('profiles').update({ approved: false }).eq('id', broker_id)
  }

  return NextResponse.json({ success: true })
}
