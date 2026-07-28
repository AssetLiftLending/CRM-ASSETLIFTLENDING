import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const form      = await req.formData()
    const file      = form.get('file') as File
    const dealId    = form.get('deal_id') as string
    const contactId = form.get('contact_id') as string
    const docType   = form.get('doc_type') as string

    if (!file || !docType) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase  = createAdminClient()
    const bytes     = await file.arrayBuffer()
    const buffer    = Buffer.from(bytes)
    const ext       = file.name.split('.').pop() ?? 'bin'
    const path      = `documents/${contactId}/${dealId}/${docType}-${Date.now()}.${ext}`

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
        deal_id:    dealId,
        contact_id: contactId,
        doc_type:   docType,
        file_name:  file.name,
        file_url:   publicUrl,
        status:     'pending',
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
