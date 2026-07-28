import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    const supabase = createServerClient()

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return NextResponse.json({ error: error.message }, { status: 401 })

    return NextResponse.json({ user: data.user })
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
