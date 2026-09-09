import { NextResponse } from 'next/server'
import { getStaffContext } from '@/lib/auth/session'
import { checkSendGridConnection } from '@/lib/sendgrid/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const staff = await getStaffContext()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = await checkSendGridConnection()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''

  return NextResponse.json({
    ...status,
    webhooks: {
      events:  `${appUrl}/api/webhooks/sendgrid/events`,
      inbound: `${appUrl}/api/webhooks/sendgrid/inbound?secret=YOUR_SENDGRID_INBOUND_SECRET`,
    },
  })
}
