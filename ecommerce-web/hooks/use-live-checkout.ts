'use client'

import { useEffect, useState } from 'react'
import { calculateCart } from '@/lib/services/commerce'
import { useCart } from '@/lib/cart-store'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { loadRazorpay } from '@/lib/payments/razorpay'
import type { CheckoutAddressRecord, DeliverySlotRecord, RazorpayOrderResponse, ResolvedCheckoutItem } from '@/types/checkout'
import type { CartLine } from '@/types/catalog'

export function useLiveCheckout({ initialCartLines, initialCartReady, initialAddresses, initialDeliverySlots, initialDataError }: { initialCartLines: CartLine[]; initialCartReady: boolean; initialAddresses: CheckoutAddressRecord[]; initialDeliverySlots: DeliverySlotRecord[]; initialDataError: string }) {
  const cart = useCart()
  const lines = cart.ready ? cart.lines : initialCartLines
  const totalQuantity = lines.reduce((total, line) => total + line.quantity, 0)
  const { clear, lineKey } = cart
  const ready = cart.ready || initialCartReady
  const [addressesFromDatabase, setAddressesFromDatabase] = useState<CheckoutAddressRecord[]>(initialAddresses)
  const [addressId, setAddressId] = useState<number | null>(initialAddresses[0]?.id ?? null)
  const firstAvailableSlot = initialDeliverySlots.find(item => item.capacity > 0)?.starts_at ?? ''
  const [slot, setSlot] = useState(firstAvailableSlot)
  const [deliverySlots, setDeliverySlots] = useState<DeliverySlotRecord[]>(initialDeliverySlots)
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
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState(initialDataError)
  const summary = calculateCart(lines)
  // A coupon replaces the automatic offer when it is better; discounts never stack.
  const appliedDiscount = Math.max(summary.discount, couponDiscount)
  const checkoutTotal = Math.max(0, summary.total + summary.discount - appliedDiscount)
  useEffect(() => {
    let active = true
    if (loadAttempt === 0) return
    setDataLoading(true)
    setDataError('')
    void (async () => {
      const client = createSupabaseBrowserClient()
      if (!client) throw new Error('Checkout data is unavailable. Check your connection and try again.')
      const [addressResult, slotsResponse] = await Promise.all([
        client.from('addresses').select('id,label,line1,city,postal_code').order('id'),
        fetch('/api/delivery-slots', { cache: 'no-store' }),
      ])
      if (addressResult.error) throw addressResult.error
      if (!slotsResponse.ok) throw new Error('Could not load available delivery slots.')
      const slotResult = await slotsResponse.json() as { slots?: DeliverySlotRecord[] }
      if (!active) return
      const loadedAddresses = (addressResult.data ?? []) as CheckoutAddressRecord[]
      const loadedSlots = slotResult.slots ?? []
      setAddressesFromDatabase(loadedAddresses)
      setAddressId(current => current && loadedAddresses.some(address => address.id === current) ? current : loadedAddresses[0]?.id ?? null)
      setDeliverySlots(loadedSlots)
      setSlot(current => loadedSlots.some(item => item.starts_at === current && item.capacity > 0) ? current : loadedSlots.find(item => item.capacity > 0)?.starts_at ?? '')
    })().catch(loadError => { if (active) setDataError(loadError instanceof Error ? loadError.message : 'Could not load checkout details.') }).finally(() => { if (active) setDataLoading(false) })
    return () => { active = false }
  }, [loadAttempt])
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
    const selected = deliverySlots.find(item => item.starts_at === slot)
    if (!selected) { setError('Choose an available delivery slot.'); setBusy(false); return }
    const { data, error: rpcError } = await client.rpc('place_order', { p_address_id: addressId, p_items: resolvedItems, p_payment_method: paymentMethod === 'prepaid' ? 'Razorpay' : 'cod', p_delivery_slot_start: selected.starts_at, p_delivery_slot_end: selected.ends_at, p_delivery_slot_label: `${selected.day}, ${selected.label}`, p_coupon_code: coupon || null, p_delivery_instructions: instructions || null, p_contactless_delivery: contactless, p_substitute_unavailable: substituteUnavailable })
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
  return { lines, totalQuantity, clear, lineKey, ready, addressesFromDatabase, addressId, setAddressId, slot, setSlot, deliverySlots, instructions, setInstructions, coupon, setCoupon, couponDiscount, setCouponDiscount, couponMessage, setCouponMessage, paymentMethod, setPaymentMethod, contactless, setContactless, substituteUnavailable, setSubstituteUnavailable, busy, error, orderId, summary, appliedDiscount, checkoutTotal, placeOrder, applyCoupon, dataLoading, dataError, retryCheckoutData: () => setLoadAttempt(attempt => attempt + 1) }
}
