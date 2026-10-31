import { NextResponse } from 'next/server'
import { z } from 'zod'
import { can } from '@/lib/permission-definitions'
import { getAdminProfile } from '@/lib/admin-auth'
import { limitedResponse, parseJson, rateLimit } from '@/lib/security/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  amount: z.number().finite().positive(),
  reason: z.string().trim().max(500).nullable().optional(),
})

type Payment = { gateway_payment_id: string | null; status: string; amount: number }
type RefundRecord = { id: number; order_id: number; status: string; type: string; amount: number; final_amount: number | null; refund_reference: string | null; orders: { payments: Payment | Payment[] | null } | { payments: Payment | Payment[] | null }[] | null }
type ExistingRefund = { id: number; status: string; amount: number; final_amount: number | null }
type RazorpayResponse = { id?: string; amount?: number; status?: string; error?: { description?: string } }

const one = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null

export async function POST(request: Request, { params }: { params: Promise<{ refundId: string }> }) {
  const profile = await getAdminProfile()
  if (!profile) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  if (!can(profile.role_name, 'refunds:pay')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const limit = rateLimit(`refund:process:${profile.id}`, 10, 60_000)
  if (!limit.allowed) return limitedResponse(limit.retryAfter)

  const { refundId: rawId } = await params
  const refundId = Number(rawId)
  if (!Number.isSafeInteger(refundId) || refundId < 1) return NextResponse.json({ error: 'INVALID_REFUND_ID' }, { status: 400 })

  const parsed = await parseJson(request, schema)
  if (parsed.error) return parsed.error
  const amountPaise = Math.round(parsed.data.amount * 100)
  if (Math.abs(parsed.data.amount * 100 - amountPaise) > 0.00001) return NextResponse.json({ error: 'INVALID_REFUND_AMOUNT' }, { status: 400 })
  const reason = parsed.data.reason?.trim() || null

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !secret) return NextResponse.json({ error: 'PAYMENT_PROVIDER_NOT_CONFIGURED' }, { status: 503 })
  if (!keyId.startsWith('rzp_test_')) return NextResponse.json({ error: 'RAZORPAY_TEST_MODE_REQUIRED' }, { status: 503 })
  const serviceClient = createSupabaseAdminClient()
  if (!serviceClient) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_NOT_CONFIGURED' }, { status: 503 })

  const supabase = await createSupabaseServerClient()
  // Admin RLS may intentionally hide payment rows; use the server-only service
  // client for lookup after enforcing this user's refunds:pay permission above.
  const { data: rawRefund, error: refundError } = await serviceClient
    .from('refunds')
    .select('id,order_id,status,type,amount,final_amount,refund_reference,orders(payments(gateway_payment_id,status,amount))')
    .eq('id', refundId)
    .maybeSingle()
  if (refundError || !rawRefund) return NextResponse.json({ error: 'REFUND_NOT_FOUND' }, { status: 404 })
  const refund = rawRefund as unknown as RefundRecord
  const allowedStep = (refund.type === 'return_and_refund' && refund.status === 'received') ||
    (refund.type === 'refund_only' && refund.status === 'approved')
  if (!allowedStep) return NextResponse.json({ error: 'INVALID_REFUND_STEP' }, { status: 409 })

  const order = one(refund.orders)
  const payment = one(order?.payments)
  if (!payment?.gateway_payment_id || payment.status !== 'captured') {
    return NextResponse.json({ error: 'RAZORPAY_CAPTURED_PAYMENT_REQUIRED' }, { status: 409 })
  }
  const maxRefund = Number(refund.final_amount ?? refund.amount)
  if (amountPaise < 1 || amountPaise > Math.round(maxRefund * 100)) {
    return NextResponse.json({ error: 'INVALID_REFUND_AMOUNT' }, { status: 400 })
  }
  if (amountPaise < Math.round(maxRefund * 100) && !reason) {
    return NextResponse.json({ error: 'PARTIAL_REFUND_REASON_REQUIRED' }, { status: 400 })
  }

  const { data: previousRows, error: previousError } = await serviceClient
    .from('refunds')
    .select('id,status,amount,final_amount')
    .eq('order_id', refund.order_id)
    .neq('status', 'cancelled')
    .neq('status', 'rejected')
  if (previousError) return NextResponse.json({ error: 'REFUND_LIMIT_CHECK_FAILED' }, { status: 503 })
  const alreadyRefunded = ((previousRows ?? []) as ExistingRefund[])
    .filter(row => row.id !== refund.id && row.status === 'refunded')
    .reduce((sum, row) => sum + Number(row.final_amount ?? row.amount), 0)
  if (alreadyRefunded + amountPaise / 100 > Number(payment.amount) + 0.001) {
    return NextResponse.json({ error: 'REFUND_EXCEEDS_AMOUNT_PAID' }, { status: 409 })
  }

  // Reusing this key and the same request makes a retry safe if Razorpay accepted
  // the refund but the connection or local status update failed.
  const idempotencyKey = `cartly-rf-${refund.id}`
  const authHeader = `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}`
  let providerResult: RazorpayResponse
  try {
    if (refund.refund_reference?.startsWith('rfnd_')) {
      const existingResponse = await fetch(`https://api.razorpay.com/v1/refunds/${encodeURIComponent(refund.refund_reference)}`, { headers: { Authorization: authHeader }, cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      const existing = await existingResponse.json().catch(() => ({})) as RazorpayResponse
      if (!existingResponse.ok || !existing.id) return NextResponse.json({ error: 'RAZORPAY_REFUND_LOOKUP_FAILED', retryable: true }, { status: 502 })
      if (existing.amount !== amountPaise) return NextResponse.json({ error: 'REFUND_ALREADY_ISSUED_DIFFERENT_AMOUNT' }, { status: 409 })
      providerResult = existing
    } else {
      const razorpayResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(payment.gateway_payment_id)}/refund`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json', 'X-Refund-Idempotency': idempotencyKey },
        body: JSON.stringify({ amount: amountPaise, receipt: idempotencyKey, notes: { cartly_refund_id: String(refund.id), cartly_order_id: String(refund.order_id), ...(reason ? { partial_refund_reason: reason } : {}) } }),
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      })
      providerResult = await razorpayResponse.json().catch(() => ({})) as RazorpayResponse
      if (!razorpayResponse.ok || !providerResult.id) {
        return NextResponse.json({ error: providerResult.error?.description || 'RAZORPAY_REFUND_FAILED' }, { status: 502 })
      }
      const { error: referenceError } = await serviceClient
        .from('refunds')
        .update({ refund_reference: providerResult.id })
        .eq('id', refund.id)
        .neq('status', 'refunded')
      if (referenceError) console.error('[refunds] Failed to save Razorpay refund reference:', referenceError.message)
    }
  } catch {
    return NextResponse.json({ error: 'RAZORPAY_REFUND_CONNECTION_FAILED', retryable: true }, { status: 502 })
  }

  const { error: statusError } = await supabase.rpc('set_refund_status', {
    p_refund_id: refund.id,
    p_status: 'refunded',
    p_final_amount: amountPaise / 100,
    p_final_amount_reason: reason,
  })
  if (statusError) {
    console.error('[refunds] Razorpay accepted refund but local status update failed:', statusError.message)
    return NextResponse.json({ error: 'RAZORPAY_REFUNDED_LOCAL_UPDATE_FAILED', retryable: true }, { status: 502 })
  }

  return NextResponse.json({ refunded: true, refundId: providerResult.id, amount: amountPaise / 100, providerStatus: providerResult.status ?? 'created' })
}
