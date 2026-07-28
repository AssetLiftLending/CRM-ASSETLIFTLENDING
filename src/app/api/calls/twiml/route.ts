import { NextRequest, NextResponse } from 'next/server'

// TwiML for outbound calls — forward to agent and record
export async function POST(_req: NextRequest) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial record="record-from-ringing-dual" recordingStatusCallback="${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/recording" timeout="30">
    <Number>${process.env.TWILIO_CELL_NUMBER}</Number>
  </Dial>
</Response>`

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}
