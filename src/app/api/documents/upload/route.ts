import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

const STAFF_ROLES = ['platform_admin', 'organization_admin', 'owner', 'loan_officer', 'processor', 'marketing']

export async function POST(req: NextRequest) {
  try {
    const form      = await req.formData()
    const file      = form.get('file') as File
    const dealId    = form.get('deal_id') as string
    const contactId = form.get('contact_id') as string
    const docType   = form.get('doc_type') as string

    if (!file || !docType || !dealId || !contactId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const authClient = createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase  = createAdminClient()
    const [{ data: profile }, { data: deal }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      supabase.from('deals').select('id, contact_id, broker_id').eq('id', dealId).eq('contact_id', contactId).single(),
    ])

    const isStaff = Boolean(profile && STAFF_ROLES.includes(profile.role))
    const isBrokerOnDeal = Boolean(profile?.role === 'broker' && deal?.broker_id === user.id)
    if (!isStaff && !isBrokerOnDeal) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!deal) return NextResponse.json({ error: 'Deal not found for this contact' }, { status: 404 })

    const { data: contact } = await supabase
      .from('contacts')
      .select('id, organization_id')
      .eq('id', contactId)
      .single()

    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    const bytes     = await file.arrayBuffer()
    const buffer    = Buffer.from(bytes)
    const ext       = file.name.split('.').pop() ?? 'bin'
    const folderPrefix = `organizations/${contact.organization_id}/contacts/${contactId}`
    const path      = `${folderPrefix}/${dealId}/${docType}-${Date.now()}.${ext}`

    await supabase.from('document_folders').upsert({
      organization_id: contact.organization_id,
      contact_id: contactId,
      storage_prefix: folderPrefix,
    }, { onConflict: 'organization_id,contact_id' })

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)

    // Upsert document record
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
        uploaded_by: profile?.role === 'broker' ? 'broker' : 'staff',
        uploaded_at: new Date().toISOString(),
      }, { onConflict: 'deal_id,doc_type' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
