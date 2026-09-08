/**
 * The CRM's public base URL, without a trailing slash.
 *
 * Webhook callbacks and Twilio's request-signature check are built from this, so
 * it has to match the address the outside world reaches the app on — byte for byte.
 *
 * NEXT_PUBLIC_APP_URL wins when set (required for a custom domain). Otherwise we
 * fall back to the production domain Vercel assigns the project, which keeps a
 * default deployment working with no configuration at all. VERCEL_URL is
 * deliberately not used: it changes with every deployment, so signature checks
 * against a statically configured webhook would start failing on the next deploy.
 */
export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return normalize(explicit)

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercel) return normalize(vercel)

  return ''
}

function normalize(value: string) {
  const withoutScheme = value.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  return withoutScheme ? `https://${withoutScheme}` : ''
}

/** Absolute URL for a path on this CRM, e.g. appUrl('/api/webhooks/twilio/voice'). */
export function appUrl(path: string) {
  return `${getAppUrl()}${path}`
}
