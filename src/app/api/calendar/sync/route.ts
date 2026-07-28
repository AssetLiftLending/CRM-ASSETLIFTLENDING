import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { listCalendarEvents } from '@/lib/ads/google'

export async function POST(_req: NextRequest) {
  try {
    const timeMin = new Date()
    timeMin.setDate(timeMin.getDate() - 30)
    const timeMax = new Date()
    timeMax.setDate(timeMax.getDate() + 180)

    const events = await listCalendarEvents(timeMin.toISOString(), timeMax.toISOString())
    const supabase = createAdminClient()

    for (const ev of events) {
      if (!ev.summary || !ev.start?.dateTime) continue
      await supabase.from('appointments').upsert({
        gcal_event_id: ev.id,
        title:         ev.summary,
        start_time:    ev.start.dateTime,
        end_time:      ev.end?.dateTime ?? null,
        notes:         ev.description ?? null,
      }, { onConflict: 'gcal_event_id' })
    }

    return NextResponse.json({ synced: events.length })
  } catch (err) {
    console.error('GCal sync error:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
