import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  const supabase = createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return NextResponse.json({ error: error.message }, { status: 401 })

  // Verify they're an approved broker
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role, approved')
    .eq('id', data.user.id)
    .single()

  if (!profile || profile.role !== 'broker') {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'This account is not a broker account.' }, { status: 403 })
  }

  if (!profile.approved) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'Your broker account is pending approval. We\'ll email you once approved.' }, { status: 403 })
  }

  return NextResponse.json({ success: true })
}
