import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { canSendCommunications, getStaffContext } from '@/lib/auth/session'
import {
  checkGhlConnection,
  isGhlConfigured,
  listConversations,
  listMessages,
} from '@/lib/ghl/client'
import { mapMessage, matchContact } from '@/lib/ghl/import'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Connection check for the import screen. */
export async function GET() {
  const staff = await getStaffContext()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await checkGhlConnection())
}

/**
 * Imports a batch of GoHighLevel conversations into the contact timeline.
 *
 * Runs a batch at a time and hands back a cursor, so a few hundred
 * conversations import as a series of short requests instead of one long one
 * that a serverless timeout would kill halfway through.
 */
export async function POST(req: NextRequest) {
  const staff = await getStaffContext()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canSendCommunications(staff.role)) {
    return NextResponse.json({ error: 'Your role cannot import history.' }, { status: 403 })
  }
  if (!isGhlConfigured()) {
    return NextResponse.json(
      { error: 'Add GHL_API_TOKEN and GHL_LOCATION_ID to your environment first.' },
      { status: 503 }
    )
  }

  let dryRun = true
  let limit = 20
  let cursor: string | undefined

  try {
    const body = await req.json()
    dryRun = body?.dryRun !== false
    limit = Math.min(Math.max(Number(body?.limit ?? 20), 1), 50)
    cursor = body?.cursor ? String(body.cursor) : undefined
  } catch {
    // Defaults are a safe dry run.
  }

  const supabase = createAdminClient()

  try {
    const { conversations, total } = await listConversations(limit, cursor)

    let messagesFound = 0
    let imported = 0
    let duplicates = 0
    let unmatched = 0
    const unmatchedNames: string[] = []
    const samples: Array<Record<string, unknown>> = []
    let lastDate: string | undefined

    for (const conversation of conversations) {
      const contact = await matchContact(supabase, conversation)

      // Paging works off the oldest conversation date seen in this batch.
      const convDate = String(
        (conversation as Record<string, unknown>).lastMessageDate ??
        (conversation as Record<string, unknown>).dateUpdated ?? ''
      )
      if (convDate) lastDate = convDate

      if (!contact) {
        unmatched++
        if (unmatchedNames.length < 10) {
          unmatchedNames.push(
            String(conversation.fullName || conversation.email || conversation.phone || conversation.id)
          )
        }
        continue
      }

      const messages = await listMessages(conversation.id)
      messagesFound += messages.length

      for (const message of messages) {
        const mapped = mapMessage(message)
        if (!mapped) continue

        if (samples.length < 5) {
          samples.push({
            contact: conversation.fullName ?? conversation.phone ?? conversation.email ?? '',
            type: mapped.type,
            direction: mapped.direction,
            date: mapped.created_at,
            preview: mapped.snippet?.slice(0, 80) ?? '',
          })
        }

        if (dryRun) { imported++; continue }

        const { error } = await supabase.from('communications').upsert({
          contact_id:      contact.id,
          organization_id: contact.organization_id ?? staff.organizationId ?? null,
          external_id:     mapped.external_id,
          type:            mapped.type,
          direction:       mapped.direction,
          subject:         mapped.subject,
          body:            mapped.body,
          snippet:         mapped.snippet,
          duration_secs:   mapped.duration_secs,
          recording_url:   mapped.recording_url,
          status:          mapped.status,
          created_at:      mapped.created_at,
        }, { onConflict: 'external_id', ignoreDuplicates: true })

        if (error) {
          // A row already present is the expected case on a re-run.
          if (error.code === '23505') duplicates++
          else throw error
        } else {
          imported++
        }
      }
    }

    return NextResponse.json({
      dryRun,
      total,
      conversationsProcessed: conversations.length,
      messagesFound,
      imported,
      duplicates,
      unmatched,
      unmatchedNames,
      samples,
      // Absent when GHL returned fewer conversations than asked for: that is the end.
      nextCursor: conversations.length === limit ? lastDate : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed'
    console.error('POST /api/import/ghl', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
