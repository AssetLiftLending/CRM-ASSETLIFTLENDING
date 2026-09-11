import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that must be reachable without a CRM staff session.
//
// The borrower portal (/portal) and broker portal (/broker) verify the session
// and the caller's role inside their own pages and route handlers, so they are
// listed here to keep the staff-only gate from swallowing them. Proxy is an
// optimistic check only — it is not the authorization boundary. See
// node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
const PUBLIC_PATHS = [
  '/login',
  '/portal',
  '/broker',
  '/api/portal/auth',
  '/api/broker/auth',
  '/api/webhooks',
  '/api/cron',
  // TwiML Twilio fetches mid-call. It carries no session, and each route checks
  // X-Twilio-Signature itself. /api/calls (placing a call) stays staff-only.
  '/api/calls/twiml',
  '/api/calls/whisper',
  '/api/calls/voicemail-twiml',
]

// Exact match or a real path segment boundary, so "/loginauthorized" does not
// slip through on a "/login" prefix.
function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`)
  )
}

function denyRequest(req: NextRequest, status: number, error: string) {
  // API callers get JSON they can actually parse. Redirecting them to the HTML
  // login page makes every client-side fetch fail with a JSON parse error.
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error }, { status })
  }
  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req })
  const { pathname } = req.nextUrl
  const isPublic = isPublicPath(pathname)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Fail closed. Without Supabase credentials no session can be verified, so
  // serving protected routes would expose the whole CRM to anonymous callers.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isPublic) return res
    console.error(
      '[proxy] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing — refusing to serve protected routes.'
    )
    return denyRequest(req, 503, 'Authentication is not configured on this server')
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return req.cookies.get(name)?.value
      },
      set(name, value, options) {
        req.cookies.set({ name, value, ...options })
        res = NextResponse.next({ request: req })
        res.cookies.set({ name, value, ...options })
      },
      remove(name, options) {
        req.cookies.set({ name, value: '', ...options })
        res = NextResponse.next({ request: req })
        res.cookies.set({ name, value: '', ...options })
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !isPublic) return denyRequest(req, 401, 'Unauthorized')
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
