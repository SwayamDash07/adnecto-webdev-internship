import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const body = await request.json() as { orderId?: number }
  const orderId = Number(body.orderId)
  if (!Number.isInteger(orderId) || orderId < 1) return NextResponse.json({ error: 'INVALID_ORDER' }, { status: 400 })
  const { data: order, error } = await supabase.from('orders').select('id,total').eq('id', orderId).eq('user_id', user.id).maybeSingle()
  if (error || !order) return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 })
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !secret) return NextResponse.json({ error: 'PAYMENT_PROVIDER_NOT_CONFIGURED' }, { status: 503 })
  const response = await fetch('https://api.razorpay.com/v1/orders', { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Math.round(Number(order.total) * 100), currency: 'INR', receipt: `cartly-${order.id}`, notes: { cartly_order_id: String(order.id) } }) })
  const result = await response.json() as { id?: string; error?: { description?: string } }
  if (!response.ok || !result.id) return NextResponse.json({ error: result.error?.description || 'RAZORPAY_ORDER_FAILED' }, { status: 502 })
  const { error: linkError } = await supabase.rpc('customer_set_gateway_order', { p_order_id: order.id, p_gateway_order_id: result.id })
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 400 })
  return NextResponse.json({ keyId, razorpayOrderId: result.id, amount: Math.round(Number(order.total) * 100), currency: 'INR' })
}
