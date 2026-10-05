'use client'

import { useEffect, useState } from 'react'
import { calculateCart } from '@/lib/services/commerce'
import { useCart } from '@/lib/cart-store'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { loadRazorpay } from '@/lib/payments/razorpay'
import type { CheckoutAddressRecord, DeliverySlotRecord, RazorpayOrderResponse, ResolvedCheckoutItem } from '@/types/checkout'

export function useLiveCheckout() {
  const { lines, totalQuantity, clear, lineKey } = useCart()
  const [addressesFromDatabase, setAddressesFromDatabase] = useState<CheckoutAddressRecord[]>([])
  const [addressId, setAddressId] = useState<number | null>(null)
  const [slot, setSlot] = useState('Tomorrow, 10 AM - 12 PM')
  const [deliverySlots, setDeliverySlots] = useState<DeliverySlotRecord[]>([])
  const [instructions, setInstructions] = useState('')
  const [coupon, setCoupon] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponMessage, setCouponMessage] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'prepaid' | 'cod'>('prepaid')
  const [contactless, setContactless] = useState(true)
  const [substituteUnavailable, setSubstituteUnavailable] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [orderId, setOrderId] = useState<number | null>(null)
  const summary = calculateCart(lines)
  const checkoutTotal = Math.max(0, summary.total - couponDiscount)
  useEffect(() => { void (async () => { const client = createSupabaseBrowserClient(); if (!client) return; const { data } = await client.from('addresses').select('id,label,line1,city,postal_code').order('id'); const loaded = (data ?? []) as CheckoutAddressRecord[]; setAddressesFromDatabase(loaded); setAddressId(loaded[0]?.id ?? null) })() }, [])
  useEffect(() => { void (async () => { const client = createSupabaseBrowserClient(); if (!client) return; const { data } = await client.from('delivery_slots').select('id,starts_at,ends_at,capacity').gte('starts_at', new Date().toISOString()).order('starts_at').limit(12); const loaded = (data ?? []) as DeliverySlotRecord[]; setDeliverySlots(loaded); if (loaded[0]) setSlot(`${new Date(loaded[0].starts_at).toLocaleString('en-IN')} · ${loaded[0].capacity} places`) })() }, [])
  useEffect(() => { const savedCoupon = localStorage.getItem('cartly_coupon_code'); if (savedCoupon) setCoupon(savedCoupon) }, [])
  async function placeOrder() {
    setBusy(true); setError('')
    const client = createSupabaseBrowserClient()
    if (!client) { setError('Supabase is not configured.'); setBusy(false); return }
    const { data: { user } } = await client.auth.getUser()
    if (!user) { setError('Please sign in before payment.'); setBusy(false); return }
    if (!addressId) { setError('Please add and select a delivery address before payment.'); setBusy(false); return }
    const resolvedItems: ResolvedCheckoutItem[] = []
    for (const line of lines) {
      let product: { id: number } | null = null
      if (line.product.sku) {
        const bySku = await client.from('products').select('id').eq('sku', line.product.sku).maybeSingle()
        product = bySku.data
      }
      if (!product) {
        const byName = await client.from('products').select('id').eq('name', line.product.name).maybeSingle()
        product = byName.data
      }
      if (!product) {
        const byId = await client.from('products').select('id').eq('id', line.product.id).maybeSingle()
        product = byId.data
      }
      if (!product) { setError(`Product not found in Supabase: ${line.product.name}`); setBusy(false); return }
      resolvedItems.push({ product_id: product.id, sku: line.product.sku, name: line.product.name, quantity: line.quantity, substitute: substituteUnavailable })
    }
    const { data, error: rpcError } = await client.rpc('place_order', { p_address_id: addressId, p_items: resolvedItems, p_payment_method: paymentMethod === 'prepaid' ? 'Razorpay' : 'cod', p_delivery_slot: `${slot}${instructions ? ` · ${instructions}` : ''}${contactless ? ' · Contactless' : ''}`, p_coupon_code: coupon || null })
    if (rpcError) {
      const message = rpcError.message ?? ''
      const stockMatch = message.match(/INSUFFICIENT_STOCK:?(\d+)?/i)
      setError(stockMatch ? 'One or more items no longer have enough stock. Please review your cart.' : message)
      setBusy(false)
      return
    }
    const createdOrderId = Number(data)
    if (paymentMethod === 'cod') { setOrderId(createdOrderId); clear(); setBusy(false); return }
    try {
      const createResponse = await fetch('/api/payments/create-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: createdOrderId }) })
      const razorpayOrder = await createResponse.json() as RazorpayOrderResponse
      if (!createResponse.ok || !razorpayOrder.keyId || !razorpayOrder.razorpayOrderId) throw new Error(razorpayOrder.error || 'Payment setup failed.')
      await loadRazorpay()
      if (!window.Razorpay) throw new Error('Razorpay checkout is unavailable.')
      new window.Razorpay({ key: razorpayOrder.keyId, amount: razorpayOrder.amount ?? Math.round(checkoutTotal * 100), currency: razorpayOrder.currency ?? 'INR', name: 'Cartly Hypermarket', description: `Order #${createdOrderId}`, order_id: razorpayOrder.razorpayOrderId, handler: response => { void fetch('/api/payments/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: createdOrderId, ...response }) }).then(async verifyResponse => { if (!verifyResponse.ok) throw new Error(((await verifyResponse.json()) as { error?: string }).error || 'Payment verification failed.'); setOrderId(createdOrderId); clear(); setBusy(false) }).catch(async verificationError => { await client.rpc('customer_cancel_order', { p_order_id: createdOrderId }); setError(verificationError instanceof Error ? verificationError.message : 'Payment verification failed.'); setBusy(false) }) }, modal: { ondismiss: () => { void client.rpc('customer_cancel_order', { p_order_id: createdOrderId }); setError('Payment cancelled. Your order was cancelled and stock was restored.'); setBusy(false) } } }).open()
    } catch (paymentError) { await client.rpc('customer_cancel_order', { p_order_id: createdOrderId }); setError(paymentError instanceof Error ? paymentError.message : 'Payment could not be started.'); setBusy(false) }
  }
  async function applyCoupon() {
    setCouponMessage(''); setCouponDiscount(0)
    if (!coupon.trim()) { setCouponMessage('Enter a coupon code.'); return }
    const client = createSupabaseBrowserClient(); if (!client) return
    const { data, error: couponError } = await client.rpc('customer_validate_coupon', { p_code: coupon, p_subtotal: summary.subtotal })
    if (couponError) setCouponMessage(couponError.message)
    else { const result = (data?.[0] ?? data) as { valid: boolean; discount: number; message: string } | null; setCouponDiscount(result?.valid ? Number(result.discount) : 0); setCouponMessage(result?.message ?? 'Coupon could not be applied.') }
  }
  return { lines, totalQuantity, clear, lineKey, addressesFromDatabase, addressId, setAddressId, slot, setSlot, deliverySlots, instructions, setInstructions, coupon, setCoupon, couponDiscount, setCouponDiscount, couponMessage, setCouponMessage, paymentMethod, setPaymentMethod, contactless, setContactless, substituteUnavailable, setSubstituteUnavailable, busy, error, orderId, summary, checkoutTotal, placeOrder, applyCoupon }
}
