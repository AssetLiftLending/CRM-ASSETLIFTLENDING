import { handleMessageStatus } from '@/lib/twilio/message-status'

export const dynamic = 'force-dynamic'

// WhatsApp delivery receipts use the same payload shape as SMS.
export const POST = handleMessageStatus
