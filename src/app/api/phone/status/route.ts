import { NextResponse } from 'next/server'
import { getStaffContext } from '@/lib/auth/session'
import { appUrl, checkTwilioConnection } from '@/lib/twilio/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const staff = await getStaffContext()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = await checkTwilioConnection()

  return NextResponse.json({
    ...status,
    agentNumber: staff.phone,
    webhooks: {
      voice:      appUrl('/api/webhooks/twilio/voice'),
      sms:        appUrl('/api/webhooks/twilio/sms'),
      callStatus: appUrl('/api/webhooks/twilio/call-status'),
      smsStatus:  appUrl('/api/webhooks/twilio/sms-status'),
    },
  })
}
