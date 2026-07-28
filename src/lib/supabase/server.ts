import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey

// Server components and request-scoped API code.
export const createServerClient = () =>
  createServerComponentClient(
    { cookies },
    { supabaseUrl, supabaseKey: supabaseAnonKey }
  )

export const createClient = createServerClient

// Service role client for API routes and server actions that need to bypass RLS.
export const createAdminClient = () =>
  createSupabaseClient(
    supabaseUrl,
    supabaseServiceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
