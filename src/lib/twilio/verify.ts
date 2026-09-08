import twilio from 'twilio'
import { NextRequest } from 'next/server'
import { appUrl } from '@/lib/twilio/client'

export interface TwilioWebhookRequest {
  params: Record<string, string>
  verified: boolean
  reason: 'ok' | 'unconfigured' | 'bad-signature'
}

/**
 * Reads a Twilio webhook body and validates its X-Twilio-Signature.
 *
 * The signature is computed over the URL Twilio was configured with, so the URL
 * is rebuilt from NEXT_PUBLIC_APP_URL rather than req.url (proxies rewrite host
 * and protocol in front of Next.js).
 */
export async function readTwilioWebhook(req: NextRequest): Promise<TwilioWebhookRequest> {
  const form = await req.formData()
  const params: Record<string, string> = {}
  form.forEach((value, key) => {
    if (typeof value === 'string') params[key] = value
  })

  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!authToken) return { params, verified: false, reason: 'unconfigured' }

  // Escape hatch for local testing with curl / the Twilio CLI. Never set in production.
  if (process.env.TWILIO_ALLOW_UNSIGNED_WEBHOOKS === 'true') {
    return { params, verified: true, reason: 'ok' }
  }

  const signature = req.headers.get('x-twilio-signature') ?? ''
  const url = appUrl(`${req.nextUrl.pathname}${req.nextUrl.search}`)

  const valid = twilio.validateRequest(authToken, signature, url, params)
  return { params, verified: valid, reason: valid ? 'ok' : 'bad-signature' }
}

/** TwiML helper — Twilio requires an XML content type. */
export function twimlResponse(xml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  })
}

export function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
