import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/sendgrid/client'

const ADMIN_ROLES = ['platform_admin', 'organization_admin', 'owner']

// POST — admin uploads term sheet PDF + sets loan terms
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !ADMIN_ROLES.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const rate = formData.get('rate') as string
  const points = formData.get('points') as string
  const ltv = formData.get('ltv') as string
  const term_months = formData.get('term_months') as string

  let termSheetUrl: string | null = null

  if (file) {
    const ext = file.name.split('.').pop()
    const path = `term-sheets/${params.id}/term-sheet-${Date.now()}.${ext}`
    const buffer = await file.arrayBuffer()
    const { error: storageError } = await admin.storage.from('documents').upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })
    if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 })

    const { data: urlData } = admin.storage.from('documents').getPublicUrl(path)
    termSheetUrl = urlData.publicUrl
  }

  // Update deal
  const updateData: Record<string, any> = {
    terms_set_at: new Date().toISOString(),
    terms_set_by: user.id,
  }
  if (termSheetUrl) updateData.term_sheet_url = termSheetUrl
  if (rate) updateData.rate = parseFloat(rate)
  if (points) updateData.points = parseFloat(points)
  if (ltv) updateData.ltv = parseFloat(ltv)
  if (term_months) updateData.term_months = parseInt(term_months)

  await admin.from('deals').update(updateData).eq('id', params.id)

  // Notify borrower + broker
  const { data: deal } = await admin
    .from('deals')
    .select('*, contacts(first_name, last_name, email), profiles!broker_id(email, full_name)')
    .eq('id', params.id)
    .single()

  if (deal?.contacts) {
    const c = deal.contacts as any
    try {
      await sendEmail({
        to: c.email,
        subject: 'Your Loan Terms Are Ready — Asset Lift Lending',
        html: `
          <h2>Hi ${c.first_name},</h2>
          <p>Great news! We've prepared your loan terms for the property at <strong>${deal.property_address}</strong>.</p>
          <table style="border-collapse:collapse;width:100%;max-width:400px">
            ${rate ? `<tr><td style="padding:6px 0;color:#666">Interest Rate</td><td style="padding:6px 0;font-weight:bold">${rate}%</td></tr>` : ''}
            ${points ? `<tr><td style="padding:6px 0;color:#666">Points</td><td style="padding:6px 0;font-weight:bold">${points}</td></tr>` : ''}
            ${ltv ? `<tr><td style="padding:6px 0;color:#666">LTV</td><td style="padding:6px 0;font-weight:bold">${ltv}%</td></tr>` : ''}
            ${term_months ? `<tr><td style="padding:6px 0;color:#666">Term</td><td style="padding:6px 0;font-weight:bold">${term_months} months</td></tr>` : ''}
          </table>
          ${termSheetUrl ? `<p style="margin-top:16px"><a href="${termSheetUrl}" style="background:#D4A017;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Download Term Sheet →</a></p>` : ''}
          <p>Log in to your portal to view your full deal status and upload any remaining documents:</p>
          <a href="https://assetliftlending.com/portal" style="background:#1A1A1A;color:#D4A017;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;border:1px solid #D4A017">View Your Portal →</a>
          <p style="margin-top:24px">Questions? Reply to this email or call us.</p>
          <p>Asset Lift Lending<br/>info@assetliftlending.com</p>
        `,
      })
    } catch (e) {
      console.error('Borrower email failed:', e)
    }

    // Also notify broker if deal was broker-submitted
    if ((deal as any).profiles?.email) {
      const b = (deal as any).profiles
      try {
        await sendEmail({
          to: b.email,
          subject: `Term Sheet Issued — ${c.first_name} ${c.last_name}`,
          html: `
            <p>Hi ${b.full_name},</p>
            <p>Asset Lift Lending has issued loan terms for your client <strong>${c.first_name} ${c.last_name}</strong> on ${deal.property_address}.</p>
            ${rate ? `<p><strong>Rate:</strong> ${rate}% | <strong>Points:</strong> ${points} | <strong>LTV:</strong> ${ltv}% | <strong>Term:</strong> ${term_months} months</p>` : ''}
            <a href="https://assetliftlending.com/broker" style="background:#D4A017;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">View in Broker Portal →</a>
          `,
        })
      } catch (e) {
        console.error('Broker email failed:', e)
      }
    }
  }

  return NextResponse.json({ success: true, termSheetUrl })
}
