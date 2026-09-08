import { NextRequest, NextResponse } from 'next/server'
import { canSendCommunications, getStaffContext } from '@/lib/auth/session'
import { formatTwilioError, getBusinessNumber, isTwilioConfigured, sendSms } from '@/lib/twilio/client'
import { toE164 } from '@/lib/twilio/phone'

export const dynamic = 'force-dynamic'

/** Sends a test text from the business number so the wiring can be proven end to end. */
export async function POST(req: NextRequest) {
  const staff = await getStaffContext()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canSendCommunications(staff.role)) {
    return NextResponse.json({ error: 'Your role cannot send texts.' }, { status: 403 })
  }
  if (!isTwilioConfigured()) {
    return NextResponse.json(
      { error: 'Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER.' },
      { status: 503 }
    )
  }

  let to = staff.phone ?? process.env.TWILIO_CELL_NUMBER ?? ''
  try {
    const body = await req.json()
    if (body?.to) to = String(body.to)
  } catch {
    // No body — fall back to the signed-in user's number.
  }

  const target = toE164(to)
  if (!target) {
    return NextResponse.json(
      { error: 'No valid number to text. Add your mobile number in Settings → Profile.' },
      { status: 400 }
    )
  }

  try {
    const msg = await sendSms(target, 'Asset Lift CRM test — your business line is connected and texting works. ✅')
    return NextResponse.json({ success: true, to: target, from: getBusinessNumber(), sid: msg.sid, status: msg.status })
  } catch (err) {
    const message = formatTwilioError(err)
    console.error('POST /api/phone/test', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
