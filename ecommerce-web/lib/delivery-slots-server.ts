import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatDeliverySlot } from '@/lib/delivery-slot'
import type { CheckoutDeliveryOptions, DeliverySlotRecord } from '@/types/checkout'

const timeZone = 'Asia/Kolkata'

function dayKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  return Number(`${parts.find(part => part.type === 'year')?.value}${parts.find(part => part.type === 'month')?.value}${parts.find(part => part.type === 'day')?.value}`)
}

export async function getAvailableDeliverySlots(): Promise<DeliverySlotRecord[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('customer_list_checkout_delivery_slots')
  if (error) throw new Error(`Could not load delivery slots: ${error.message}`)
  return (data ?? []).map((slot: { starts_at: string; ends_at: string; capacity: number }) => ({
    starts_at: slot.starts_at,
    ends_at: slot.ends_at,
    capacity: Number(slot.capacity),
    label: formatDeliverySlot({ status: 'placed', delivery_slot_start: slot.starts_at, delivery_slot_end: slot.ends_at }).display ?? undefined,
  }))
}

export async function getCheckoutDeliveryOptions(): Promise<CheckoutDeliveryOptions> {
  const now = new Date()
  const slots = await getAvailableDeliverySlots()
  const today = dayKey(now)
  const standard = slots
    .filter(slot => dayKey(new Date(slot.starts_at)) > today)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0] ?? null
  const standardStart = standard ? Date.parse(standard.starts_at) : Number.POSITIVE_INFINITY
  const express = standard ? slots
    .filter(slot => Date.parse(slot.starts_at) >= now.getTime() + 2 * 60 * 60 * 1000 && Date.parse(slot.starts_at) < standardStart)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0] ?? null : null
  return { standard, express }
}
