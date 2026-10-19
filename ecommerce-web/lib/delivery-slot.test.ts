import { describe, expect, it } from 'vitest'
import { formatDeliverySlot } from './delivery-slot'

const now = new Date('2026-10-15T04:00:00.000Z') // 9:30 AM IST
const slot = (start: string, end: string, status = 'placed', delivered_at: string | null = null) => formatDeliverySlot({ status, delivery_slot_start: start, delivery_slot_end: end, delivered_at }, now)

describe('formatDeliverySlot', () => {
  it('formats today and tomorrow from the current IST date', () => {
    expect(slot('2026-10-15T08:30:00Z', '2026-10-15T10:30:00Z').display).toBe('Today, 2 PM - 4 PM')
    expect(slot('2026-10-16T04:30:00Z', '2026-10-16T06:30:00Z').display).toBe('Tomorrow, 10 AM - 12 PM')
  })
  it('formats later dates and missed slots', () => {
    expect(slot('2026-10-16T08:30:00Z', '2026-10-16T10:30:00Z').display).toBe('Tomorrow, 2 PM - 4 PM')
    const missed = slot('2026-10-15T01:30:00Z', '2026-10-15T03:30:00Z')
    expect(missed.display).toBe('Was due Today, 7 AM - 9 AM')
    expect(missed).toMatchObject({ state: 'late', late: true })
  })
  it('formats delivered, cancelled, and legacy null slots', () => {
    expect(slot('2026-10-14T04:30:00Z', '2026-10-14T06:30:00Z', 'delivered', '2026-10-15T05:50:00Z').display).toBe('Delivered on 15 Oct 2026, 11:20 AM')
    expect(slot('2026-10-14T04:30:00Z', '2026-10-14T06:30:00Z', 'delivered').display).toBe('Delivered · Slot: 14 Oct 2026')
    expect(slot('2026-10-14T04:30:00Z', '2026-10-14T06:30:00Z', 'cancelled').display).toBe('Cancelled')
    expect(formatDeliverySlot({ status: 'placed', delivery_slot: 'Tomorrow, 10 AM - 12 PM' }, now).display).toBe('Tomorrow, 10 AM - 12 PM')
    expect(formatDeliverySlot({ status: 'cancelled', delivery_slot: 'Tomorrow' }, now).display).toBe('Cancelled')
  })
  it('handles an IST midnight boundary and 11 PM IST despite UTC date differences', () => {
    const boundary = new Date('2026-10-15T19:31:00Z')
    expect(formatDeliverySlot({ status: 'placed', delivery_slot_start: '2026-10-15T18:30:00Z', delivery_slot_end: '2026-10-15T19:30:00Z' }, boundary).display).toBe('Was due Today, 12 AM - 1 AM')
    expect(formatDeliverySlot({ status: 'placed', delivery_slot_start: '2026-10-15T17:30:00Z', delivery_slot_end: '2026-10-15T18:30:00Z' }, now).display).toBe('Today, 11 PM - 12 AM')
  })
})
