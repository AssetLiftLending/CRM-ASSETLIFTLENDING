import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/sendgrid/client'

export const runtime = 'nodejs'

const PDFDocument = require('pdfkit')

const ADMIN_ROLES = ['platform_admin', 'organization_admin', 'owner', 'loan_officer', 'processor']
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://assetlift-crm.vercel.app'
const PORTAL_URL = 'https://assetliftlending.com/portal'
const BROKER_URL = 'https://assetliftlending.com/broker'

type TermValues = {
  rate: string
  points: string
  ltv: string
  term_months: string
  loan_amount: string
  purchase_price: string
  rehab_amount: string
  after_repair_value: string
  origination_fee: string
  appraisal_fee: string
  draw_schedule: string
  expiration_date: string
  special_conditions: string
}

function text(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback
  return String(value)
}

function toNumber(value: string | null) {
  if (!value) return null
  const cleaned = value.replace(/[$,%\s,]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function money(value: unknown) {
  const parsed = typeof value === 'number' ? value : toNumber(text(value))
  if (parsed === null) return 'TBD'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(parsed)
}

function percent(value: unknown) {
  if (value === null || value === undefined || value === '') return 'TBD'
  return `${value}%`
}

function firstContactName(contact: any) {
  const first = text(contact?.first_name).trim()
  const last = text(contact?.last_name).trim()
  return `${first} ${last}`.trim() || 'Borrower'
}

function fieldFromForm(formData: FormData, key: keyof TermValues) {
  return text(formData.get(key)).trim()
}

function drawRow(doc: any, label: string, value: string, x: number, y: number, width: number) {
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor('#6B7280')
    .text(label.toUpperCase(), x, y, { width })
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#111827')
    .text(value || 'TBD', x, y + 13, { width })
}

function drawSection(doc: any, title: string, y: number) {
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#111827')
    .text(title, 48, y)
  doc
    .moveTo(48, y + 18)
    .lineTo(564, y + 18)
    .lineWidth(1)
    .strokeColor('#E5E7EB')
    .stroke()
}

function generateTermSheetPdf(deal: any, values: TermValues) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 48, bufferPages: true })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const contact = deal.contacts
    const borrowerName = firstContactName(contact)
    const issuedAt = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const expiration = values.expiration_date
      ? new Date(`${values.expiration_date}T12:00:00`).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'TBD'

    doc.rect(0, 0, 612, 100).fill('#111111')
    doc.roundedRect(48, 28, 38, 38, 8).fill('#D4A017')
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111111').text('AL', 57, 39)
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#FFFFFF').text('Asset Lift Lending', 98, 28)
    doc.font('Helvetica').fontSize(9).fillColor('#D4A017').text('Capital that lifts.', 99, 54)
    doc.font('Helvetica').fontSize(8).fillColor('#D1D5DB').text('info@assetliftlending.com  |  +1 929-639-2284  |  assetliftlending.com', 330, 36, {
      width: 234,
      align: 'right',
    })

    doc.font('Helvetica-Bold').fontSize(22).fillColor('#111827').text('Indicative Term Sheet', 48, 132)
    doc.font('Helvetica').fontSize(9).fillColor('#6B7280').text(`Issued ${issuedAt}`, 48, 160)
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#D4A017').text(`Expires ${expiration}`, 450, 160, {
      width: 114,
      align: 'right',
    })

    doc.roundedRect(48, 188, 516, 88, 10).fill('#F9FAFB').strokeColor('#E5E7EB').stroke()
    drawRow(doc, 'Borrower', borrowerName, 68, 208, 150)
    drawRow(doc, 'Email', text(contact?.email, 'TBD'), 242, 208, 140)
    drawRow(doc, 'Phone', text(contact?.phone, 'TBD'), 406, 208, 130)
    drawRow(doc, 'Property', text(deal.property_address, 'TBD'), 68, 246, 468)

    drawSection(doc, 'Loan Structure', 306)
    drawRow(doc, 'Loan Program', text(deal.loan_program, 'TBD').replace(/_/g, ' '), 48, 336, 120)
    drawRow(doc, 'Loan Amount', money(values.loan_amount || deal.loan_amount), 188, 336, 110)
    drawRow(doc, 'Purchase Price', money(values.purchase_price || deal.purchase_price), 318, 336, 110)
    drawRow(doc, 'Rehab Budget', money(values.rehab_amount || deal.rehab_amount), 448, 336, 110)
    drawRow(doc, 'ARV', money(values.after_repair_value || deal.after_repair_value || deal.arv), 48, 382, 120)
    drawRow(doc, 'LTV', percent(values.ltv || deal.ltv), 188, 382, 110)
    drawRow(doc, 'Term', values.term_months ? `${values.term_months} months` : deal.term_months ? `${deal.term_months} months` : 'TBD', 318, 382, 110)
    drawRow(doc, 'Interest Rate', percent(values.rate || deal.rate), 448, 382, 110)

    drawSection(doc, 'Pricing And Fees', 442)
    drawRow(doc, 'Points', values.points || text(deal.points, 'TBD'), 48, 472, 120)
    drawRow(doc, 'Origination Fee', values.origination_fee || 'TBD', 188, 472, 140)
    drawRow(doc, 'Appraisal Fee', values.appraisal_fee ? money(values.appraisal_fee) : 'TBD', 348, 472, 130)
    drawRow(doc, 'Draw / Holdback', values.draw_schedule || 'Per approved scope and draw schedule', 48, 518, 490)

    drawSection(doc, 'Conditions', 578)
    doc.font('Helvetica').fontSize(10).fillColor('#111827').text(
      values.special_conditions ||
        'Final approval is subject to underwriting, valuation, title, insurance, entity review, satisfactory documentation, and Asset Lift Lending credit approval.',
      48,
      608,
      { width: 516, lineGap: 3 }
    )

    doc.font('Helvetica').fontSize(8).fillColor('#6B7280').text(
      'This term sheet is for discussion purposes only and is not a commitment to lend. Final terms may change based on due diligence, market conditions, borrower qualifications, property condition, title, insurance, and complete underwriting approval.',
      48,
      704,
      { width: 516, align: 'center' }
    )

    doc.end()
  })
}

async function uploadTermSheet(admin: any, dealId: string, buffer: Buffer, contentType = 'application/pdf') {
  const path = `term-sheets/${dealId}/assetlift-term-sheet-${Date.now()}.pdf`
  const { error } = await admin.storage.from('documents').upload(path, buffer, {
    contentType,
    upsert: true,
  })
  if (error) throw error
  const { data: urlData } = admin.storage.from('documents').getPublicUrl(path)
  return { path, publicUrl: urlData.publicUrl }
}

// POST - generates or uploads a term sheet, saves terms, publishes to the portal, and emails borrower/broker.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const shouldEmailBorrower = formData.get('email_borrower') !== 'false'
  const shouldEmailBroker = formData.get('email_broker') !== 'false'

  const values: TermValues = {
    rate: fieldFromForm(formData, 'rate'),
    points: fieldFromForm(formData, 'points'),
    ltv: fieldFromForm(formData, 'ltv'),
    term_months: fieldFromForm(formData, 'term_months'),
    loan_amount: fieldFromForm(formData, 'loan_amount'),
    purchase_price: fieldFromForm(formData, 'purchase_price'),
    rehab_amount: fieldFromForm(formData, 'rehab_amount'),
    after_repair_value: fieldFromForm(formData, 'after_repair_value'),
    origination_fee: fieldFromForm(formData, 'origination_fee'),
    appraisal_fee: fieldFromForm(formData, 'appraisal_fee'),
    draw_schedule: fieldFromForm(formData, 'draw_schedule'),
    expiration_date: fieldFromForm(formData, 'expiration_date'),
    special_conditions: fieldFromForm(formData, 'special_conditions'),
  }

  const { data: deal, error: dealError } = await admin
    .from('deals')
    .select('*, contacts(id, first_name, last_name, email, phone, organization_id), profiles!broker_id(email, full_name)')
    .eq('id', params.id)
    .single()

  if (dealError || !deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  let fileBuffer: Buffer
  let fileName = 'Asset Lift Lending Term Sheet.pdf'
  let contentType = 'application/pdf'

  if (file && file.size > 0) {
    fileName = file.name
    contentType = file.type || 'application/pdf'
    fileBuffer = Buffer.from(await file.arrayBuffer())
  } else {
    fileBuffer = await generateTermSheetPdf(deal, values)
  }

  let uploaded: { path: string; publicUrl: string }
  try {
    uploaded = await uploadTermSheet(admin, params.id, fileBuffer, contentType)
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Term sheet upload failed' }, { status: 500 })
  }

  const contact = (deal as any).contacts
  const organizationId = deal.organization_id ?? contact?.organization_id
  const updateData: Record<string, any> = {
    term_sheet_url: uploaded.publicUrl,
    terms_set_at: new Date().toISOString(),
    terms_set_by: user.id,
  }

  const numericDealFields: Array<[keyof TermValues, string, 'float' | 'int']> = [
    ['rate', 'rate', 'float'],
    ['points', 'points', 'float'],
    ['ltv', 'ltv', 'float'],
    ['term_months', 'term_months', 'int'],
    ['loan_amount', 'loan_amount', 'int'],
    ['purchase_price', 'purchase_price', 'int'],
    ['rehab_amount', 'rehab_amount', 'int'],
    ['after_repair_value', 'after_repair_value', 'int'],
    ['after_repair_value', 'arv', 'int'],
  ]

  for (const [formKey, dbKey, kind] of numericDealFields) {
    const parsed = toNumber(values[formKey])
    if (parsed !== null) updateData[dbKey] = kind === 'int' ? Math.round(parsed) : parsed
  }

  const { error: updateError } = await admin.from('deals').update(updateData).eq('id', params.id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  if (contact?.id) {
    await admin.from('documents').upsert({
      name: fileName,
      deal_id: params.id,
      contact_id: contact.id,
      organization_id: organizationId,
      doc_type: 'term_sheet',
      file_name: fileName,
      file_url: uploaded.publicUrl,
      file_size: fileBuffer.length,
      mime_type: contentType,
      storage_path: uploaded.path,
      status: 'approved',
      uploaded_by: 'staff',
      uploaded_at: new Date().toISOString(),
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }, { onConflict: 'deal_id,doc_type' })
  }

  const borrowerName = firstContactName(contact)
  const termRows = `
    ${values.rate ? `<tr><td style="padding:6px 0;color:#666">Interest Rate</td><td style="padding:6px 0;font-weight:bold">${values.rate}%</td></tr>` : ''}
    ${values.points ? `<tr><td style="padding:6px 0;color:#666">Points</td><td style="padding:6px 0;font-weight:bold">${values.points}</td></tr>` : ''}
    ${values.ltv ? `<tr><td style="padding:6px 0;color:#666">LTV</td><td style="padding:6px 0;font-weight:bold">${values.ltv}%</td></tr>` : ''}
    ${values.term_months ? `<tr><td style="padding:6px 0;color:#666">Term</td><td style="padding:6px 0;font-weight:bold">${values.term_months} months</td></tr>` : ''}
    ${values.loan_amount ? `<tr><td style="padding:6px 0;color:#666">Loan Amount</td><td style="padding:6px 0;font-weight:bold">${money(values.loan_amount)}</td></tr>` : ''}
  `

  const emailResults = { borrower: 'skipped', broker: 'skipped' }

  if (shouldEmailBorrower && contact?.email) {
    try {
      await sendEmail({
        to: contact.email,
        subject: 'Your Asset Lift Lending Term Sheet Is Ready',
        html: `
          <h2>Hi ${text(contact.first_name, borrowerName)},</h2>
          <p>Your term sheet is ready for the property at <strong>${text(deal.property_address, 'your investment property')}</strong>.</p>
          <table style="border-collapse:collapse;width:100%;max-width:440px">${termRows}</table>
          <p style="margin-top:16px"><a href="${uploaded.publicUrl}" style="background:#D4A017;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Download Term Sheet</a></p>
          <p>You can also log in to your portal to view your deal and upload any remaining documents.</p>
          <p><a href="${PORTAL_URL}" style="background:#1A1A1A;color:#D4A017;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;border:1px solid #D4A017">Open Borrower Portal</a></p>
          <p style="margin-top:24px">Asset Lift Lending<br/>info@assetliftlending.com<br/>+1 929-639-2284</p>
        `,
      })
      emailResults.borrower = 'sent'
    } catch (error) {
      console.error('Borrower term sheet email failed:', error)
      emailResults.borrower = 'failed'
    }
  }

  if (shouldEmailBroker && (deal as any).profiles?.email) {
    const broker = (deal as any).profiles
    try {
      await sendEmail({
        to: broker.email,
        subject: `Term Sheet Issued - ${borrowerName}`,
        html: `
          <p>Hi ${text(broker.full_name, 'there')},</p>
          <p>Asset Lift Lending has issued a term sheet for <strong>${borrowerName}</strong> on ${text(deal.property_address, 'the submitted property')}.</p>
          <table style="border-collapse:collapse;width:100%;max-width:440px">${termRows}</table>
          <p style="margin-top:16px"><a href="${uploaded.publicUrl}" style="background:#D4A017;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Download Term Sheet</a></p>
          <p><a href="${BROKER_URL}" style="color:#D4A017;font-weight:bold;">View in Broker Portal</a></p>
        `,
      })
      emailResults.broker = 'sent'
    } catch (error) {
      console.error('Broker term sheet email failed:', error)
      emailResults.broker = 'failed'
    }
  }

  return NextResponse.json({
    success: true,
    termSheetUrl: uploaded.publicUrl,
    portalUrl: `${APP_URL}/portal`,
    emailResults,
  })
}
