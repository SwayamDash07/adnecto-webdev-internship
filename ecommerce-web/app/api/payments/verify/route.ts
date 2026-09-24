import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { limitedResponse, parseJson, rateLimit } from '@/lib/security/server'
import { z } from 'zod'

const schema = z.object({ orderId: z.coerce.number().int().positive(), razorpay_order_id: z.string().min(1).max(100), razorpay_payment_id: z.string().min(1).max(100), razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i) })

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const limit = rateLimit(`payment:verify:${user.id}`, 10, 60_000)
  if (!limit.allowed) return limitedResponse(limit.retryAfter)
  const parsed = await parseJson(request, schema)
  if (parsed.error) return parsed.error
  const body = parsed.data
  const orderId = body.orderId
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '').update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`).digest('hex')
  const expectedBuffer = Buffer.from(expected); const signatureBuffer = Buffer.from(body.razorpay_signature)
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) return NextResponse.json({ error: 'PAYMENT_SIGNATURE_INVALID' }, { status: 400 })
  const { error } = await supabase.rpc('customer_mark_payment_captured', { p_order_id: orderId, p_gateway_order_id: body.razorpay_order_id, p_gateway_payment_id: body.razorpay_payment_id, p_gateway_signature: body.razorpay_signature })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ captured: true })
}
