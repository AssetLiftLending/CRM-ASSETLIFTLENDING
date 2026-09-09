import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

// Server components and request-scoped API code.
export const createServerClient = async () => {
  const cookieStore = await cookies()

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
//
// This must never silently fall back to the anon key: callers assume RLS is
// bypassed, so an anon-key client returns empty result sets instead of the real
// rows, and the data simply looks like it vanished. Fail loudly instead.
export const createAdminClient = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseServiceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Server-side database access requires the service role key — ' +
      'copy it from the Supabase dashboard (Project Settings → API) into .env.local.'
    )
  }

  return createSupabaseClient(
    supabaseUrl,
    supabaseServiceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
