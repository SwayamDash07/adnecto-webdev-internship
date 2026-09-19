import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const body = await request.json() as { orderId?: number; razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string }
  const orderId = Number(body.orderId)
  if (!Number.isInteger(orderId) || !body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) return NextResponse.json({ error: 'INVALID_PAYMENT_RESPONSE' }, { status: 400 })
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '').update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`).digest('hex')
  const expectedBuffer = Buffer.from(expected); const signatureBuffer = Buffer.from(body.razorpay_signature)
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) return NextResponse.json({ error: 'PAYMENT_SIGNATURE_INVALID' }, { status: 400 })
  const { error } = await supabase.rpc('customer_mark_payment_captured', { p_order_id: orderId, p_gateway_order_id: body.razorpay_order_id, p_gateway_payment_id: body.razorpay_payment_id, p_gateway_signature: body.razorpay_signature })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ captured: true })
}
