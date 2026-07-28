import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey

// Server components and request-scoped API code.
export const createServerClient = () => {
  const cookieStore = cookies()

  return createSupabaseServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Server Components cannot set cookies; middleware handles refresh writes.
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Server Components cannot set cookies; middleware handles refresh writes.
          }
        },
      },
    }
  )
}

export const createClient = createServerClient

// Service role client for API routes and server actions that need to bypass RLS.
export const createAdminClient = () =>
  createSupabaseClient(
    supabaseUrl,
    supabaseServiceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
