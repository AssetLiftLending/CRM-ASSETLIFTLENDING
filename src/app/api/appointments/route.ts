import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createCalendarEvent } from '@/lib/ads/google'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        title:      body.title,
        start_time: body.start_time,
        end_time:   body.end_time   ?? null,
        notes:      body.notes      ?? null,
        contact_id: body.contact_id ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Optionally sync to Google Calendar
    try {
      await createCalendarEvent({
        summary: body.title,
        start: body.start_time,
        end: body.end_time ?? body.start_time,
        description: body.notes ?? '',
      })
    } catch { /* GCal sync optional — continue even if it fails */ }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Appointment error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function GET() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('appointments')
    .select('*, contacts(first_name, last_name)')
    .order('start_time')
  return NextResponse.json(data ?? [])
}
