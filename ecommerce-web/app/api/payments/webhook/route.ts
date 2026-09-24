import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!webhookSecret) return NextResponse.json({ error: 'WEBHOOK_NOT_CONFIGURED' }, { status: 503 })
  const rawBody = await request.text()
  const receivedSignature = request.headers.get('x-razorpay-signature') || ''
  const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
  const expected = Buffer.from(expectedSignature); const received = Buffer.from(receivedSignature)
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return NextResponse.json({ error: 'INVALID_WEBHOOK_SIGNATURE' }, { status: 400 })
  let payload: { event?: string; payload?: { payment?: { entity?: { order_id?: string; id?: string; status?: string } }; order?: { entity?: { id?: string; notes?: { cartly_order_id?: string } } } } }
  try { payload = JSON.parse(rawBody) as typeof payload } catch { return NextResponse.json({ error: 'INVALID_WEBHOOK_BODY' }, { status: 400 }) }
  const payment = payload.payload?.payment?.entity
  if (!payment?.order_id || !payment.id) return NextResponse.json({ received: true })
  const client = createSupabaseAdminClient()
  if (!client) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_NOT_CONFIGURED' }, { status: 503 })
  const eventId = request.headers.get('x-razorpay-event-id') || crypto.createHash('sha256').update(rawBody).digest('hex')
  if (payload.event === 'payment.captured' || payload.event === 'payment.failed') await client.rpc('system_process_payment_event', { p_event_id: eventId, p_event_name: payload.event, p_gateway_order_id: payment.order_id, p_gateway_payment_id: payment.id, p_payload: payload })
  return NextResponse.json({ received: true })
}
