import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

export const createClient = () =>
  createSupabaseBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  )

export const createBrowserClient = createClient
