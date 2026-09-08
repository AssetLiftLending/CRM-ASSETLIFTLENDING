import { NextRequest, NextResponse } from 'next/server'
import { canSendCommunications, getStaffContext } from '@/lib/auth/session'
import {
  formatSendGridError,
  getFromAddress,
  isSendGridConfigured,
  isValidEmail,
  sendEmail,
} from '@/lib/sendgrid/client'

export const dynamic = 'force-dynamic'

/** Sends a test email to the signed-in user (or a supplied address) and reports the real failure reason. */
export async function POST(req: NextRequest) {
  const staff = await getStaffContext()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canSendCommunications(staff.role)) {
    return NextResponse.json({ error: 'Your role cannot send email.' }, { status: 403 })
  }
  if (!isSendGridConfigured()) {
    return NextResponse.json(
      { error: 'SENDGRID_API_KEY is not set. Add it to your environment and redeploy.' },
      { status: 503 }
    )
  }

  let to = staff.email ?? ''
  try {
    const body = await req.json()
    if (body?.to) to = String(body.to).trim()
  } catch {
    // No body — fall back to the signed-in user's address.
  }

  if (!isValidEmail(to)) {
    return NextResponse.json({ error: 'No valid address to send the test to.' }, { status: 400 })
  }

  const from = getFromAddress()
  const sentAt = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })

  try {
    const result = await sendEmail({
      to,
      subject: 'Asset Lift CRM — email test',
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1f2328;line-height:1.6">
          <h2 style="margin:0 0 12px">Email is working ✅</h2>
          <p>This test was sent from the Asset Lift Lending CRM.</p>
          <ul>
            <li><strong>From:</strong> ${from.name} &lt;${from.email}&gt;</li>
            <li><strong>Sent by:</strong> ${staff.fullName ?? staff.email ?? 'CRM user'}</li>
            <li><strong>Sent at:</strong> ${sentAt} ET</li>
          </ul>
          <p style="color:#6b7280;font-size:13px">If this landed in spam, finish domain authentication in SendGrid.</p>
        </div>`,
      categories: ['crm-test'],
    })

    return NextResponse.json({ success: true, to, messageId: result.messageId, statusCode: result.statusCode })
  } catch (err) {
    const message = formatSendGridError(err)
    console.error('POST /api/email/test', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
