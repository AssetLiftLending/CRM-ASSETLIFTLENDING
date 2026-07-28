// Google Ads API integration (basic — full SDK optional)
// Uses Google Ads API v17

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
const CUSTOMER_ID     = process.env.GOOGLE_ADS_CUSTOMER_ID
const GOOGLE_ADS_BASE = 'https://googleads.googleapis.com/v17'

async function getGoogleAccessToken() {
  const { google } = await import('googleapis')
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  const { token } = await auth.getAccessToken()
  return token
}

async function googleAdsFetch(path: string, body?: Record<string, unknown>) {
  const token = await getGoogleAccessToken()
  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${CUSTOMER_ID}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': DEVELOPER_TOKEN!,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Google Ads API error: ${res.status}`)
  return res.json()
}

// Get campaign performance
export async function getGoogleCampaigns() {
  const query = `
    SELECT campaign.id, campaign.name, campaign.status,
           metrics.impressions, metrics.clicks, metrics.cost_micros,
           metrics.conversions, metrics.conversion_value
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY metrics.impressions DESC
    LIMIT 50`

  return googleAdsFetch('/googleAds:searchStream', {
    query: query.trim(),
  })
}

// Get keyword performance
export async function getTopKeywords() {
  const query = `
    SELECT ad_group_criterion.keyword.text,
           ad_group_criterion.keyword.match_type,
           metrics.impressions, metrics.clicks,
           metrics.cost_micros, metrics.conversions
    FROM keyword_view
    WHERE segments.date DURING LAST_30_DAYS
      AND campaign.advertising_channel_type = 'SEARCH'
    ORDER BY metrics.conversions DESC
    LIMIT 20`

  return googleAdsFetch('/googleAds:searchStream', { query: query.trim() })
}

// Google Calendar helpers
export async function createCalendarEvent(event: {
  summary: string
  description?: string
  start: string
  end: string
  attendeeEmails?: string[]
}) {
  const { google } = await import('googleapis')
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  const calendar = google.calendar({ version: 'v3', auth })

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.start, timeZone: 'America/New_York' },
      end:   { dateTime: event.end,   timeZone: 'America/New_York' },
      attendees: event.attendeeEmails?.map((email) => ({ email })),
    },
  })
  return res.data
}

export async function listCalendarEvents(timeMin: string, timeMax: string) {
  const { google } = await import('googleapis')
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  const calendar = google.calendar({ version: 'v3', auth })

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  })
  return res.data.items ?? []
}
