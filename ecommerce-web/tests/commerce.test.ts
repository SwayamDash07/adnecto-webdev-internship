import { describe, expect, it } from 'vitest'
import { calculateCart } from '@/lib/services/commerce'
import { canTransitionOrder, reservationDelta } from '@/lib/services/order-lifecycle'
import { isValidRazorpaySignature } from '@/lib/services/payment-validation'

const product = { id: 1, name: 'Rice', price: 100, oldPrice: 120, stock: 10, rating: 4, reviews: 2, category: 'Grocery', gst: 5 } as never

describe('commerce pricing', () => {
  it('calculates GST, packing, delivery and threshold discount', () => {
    const result = calculateCart([{ product, quantity: 1 }])
    expect(result.subtotal).toBe(100)
    expect(result.gst).toBe(5)
    expect(result.delivery).toBe(49)
    expect(result.total).toBe(173)
  })
})

describe('inventory reservation', () => {
  it('does not reserve already reserved stock', () => {
    expect(reservationDelta(10, 8, 3).ok).toBe(false)
    expect(reservationDelta(10, 8, 2).ok).toBe(true)
  })
})

describe('order and payment validation', () => {
  it('accepts only legal order transitions', () => {
    expect(canTransitionOrder('placed', 'accepted')).toBe(true)
    expect(canTransitionOrder('delivered', 'picking')).toBe(false)
  })

  it('rejects malformed payment signatures before gateway verification', () => {
    expect(isValidRazorpaySignature('order', 'payment', 'bad', 'secret')).toBe(false)
  })
})
