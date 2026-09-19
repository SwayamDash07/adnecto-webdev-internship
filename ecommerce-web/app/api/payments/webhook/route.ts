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
  const payload = JSON.parse(rawBody) as { event?: string; payload?: { payment?: { entity?: { order_id?: string; id?: string; status?: string } }; order?: { entity?: { id?: string; notes?: { cartly_order_id?: string } } } } }
  const payment = payload.payload?.payment?.entity
  if (!payment?.order_id || !payment.id) return NextResponse.json({ received: true })
  const client = createSupabaseAdminClient()
  if (!client) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_NOT_CONFIGURED' }, { status: 503 })
  const status = payload.event === 'payment.captured' ? 'captured' : payload.event === 'payment.failed' ? 'failed' : null
  if (status) {
    await client.from('payments').update({ status, gateway_order_id: payment.order_id, gateway_payment_id: payment.id }).eq('gateway_order_id', payment.order_id)
    if (status === 'failed') await client.rpc('system_mark_payment_failed', { p_gateway_order_id: payment.order_id })
  }
  return NextResponse.json({ received: true })
}
