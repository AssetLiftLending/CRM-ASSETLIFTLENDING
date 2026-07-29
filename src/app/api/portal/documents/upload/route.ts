import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    // Verify portal user
    const supabaseAuth = createServerClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form      = await req.formData()
    const file      = form.get('file') as File
    const dealId    = form.get('deal_id') as string
    const contactId = form.get('contact_id') as string
    const docType   = form.get('doc_type') as string

    if (!file || !docType || !dealId || !contactId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify the contact matches the logged-in user's email
    const [{ data: contact }, { data: deal }] = await Promise.all([
      supabase
      .from('contacts')
      .select('id, organization_id')
      .eq('id', contactId)
      .eq('email', user.email)
      .single(),
      supabase
        .from('deals')
        .select('id, contact_id, organization_id, broker_id')
        .eq('id', dealId)
        .eq('contact_id', contactId)
        .single(),
    ])

    if (!contact) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!deal) return NextResponse.json({ error: 'Deal not found for this borrower' }, { status: 404 })

    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const ext    = file.name.split('.').pop() ?? 'bin'
    const folderPrefix = `organizations/${contact.organization_id}/contacts/${contactId}`
    const path   = `${folderPrefix}/${dealId}/${docType}-${Date.now()}.${ext}`

    await supabase.from('document_folders').upsert({
      organization_id: contact.organization_id,
      contact_id: contactId,
      portal_user_id: user.id,
      broker_id: deal.broker_id,
      storage_prefix: folderPrefix,
    }, { onConflict: 'organization_id,contact_id' })

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)

    const { data, error } = await supabase
      .from('documents')
      .upsert({
        name:       file.name,
        deal_id:    dealId,
        contact_id: contactId,
        organization_id: contact.organization_id,
        doc_type:   docType,
        file_name:  file.name,
        file_url:   publicUrl,
        file_size:  file.size,
        mime_type:  file.type || null,
        storage_path: path,
        status:     'pending',
        uploaded_by: 'borrower',
        uploaded_at: new Date().toISOString(),
      }, { onConflict: 'deal_id,doc_type' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notify lender
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/automations/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trigger_type: 'document_uploaded',
        contact_id:   contactId,
        metadata:     { doc_type: docType, file_name: file.name },
      }),
    }).catch(() => {})

    return NextResponse.json(data)
  } catch (err) {
    console.error('Portal upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
