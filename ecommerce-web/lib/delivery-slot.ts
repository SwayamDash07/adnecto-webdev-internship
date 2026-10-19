export type DeliverySlotOrder = {
  status: string
  delivery_slot?: string | null
  delivery_slot_start?: string | null
  delivery_slot_end?: string | null
  delivered_at?: string | null
}

export type DeliverySlotState = 'pending' | 'late' | 'delivered' | 'cancelled' | 'none'

const zone = 'Asia/Kolkata'
const dateParts = (date: Date) => {
  const values = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  return { year: Number(values.find(x => x.type === 'year')?.value), month: Number(values.find(x => x.type === 'month')?.value), day: Number(values.find(x => x.type === 'day')?.value) }
}
const dateKey = (value: { year: number; month: number; day: number }) => value.year * 10000 + value.month * 100 + value.day
const dateLabel = (date: Date, withYear = false) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, day: '2-digit', month: 'short', ...(withYear ? { year: 'numeric' as const } : {}) }).format(date)
export const formatISTTime = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-IN', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).formatToParts(date)
  const hour = parts.find(x => x.type === 'hour')?.value
  const minute = parts.find(x => x.type === 'minute')?.value
  const dayPeriod = parts.find(x => x.type === 'dayPeriod')?.value?.toUpperCase()
  return `${hour}${minute === '00' ? '' : `:${minute}`} ${dayPeriod}`
}
const dayDifference = (a: Date, b: Date) => {
  const pa = dateParts(a), pb = dateParts(b)
  return Math.round((Date.UTC(pa.year, pa.month - 1, pa.day) - Date.UTC(pb.year, pb.month - 1, pb.day)) / 86400000)
}

export function formatDeliverySlot(order: DeliverySlotOrder, now = new Date()): { display: string | null; state: DeliverySlotState; late: boolean } {
  const status = order.status.toLowerCase()
  if (status === 'cancelled') return { display: 'Cancelled', state: 'cancelled', late: false }
  if (status === 'delivered') {
    if (order.delivered_at) return { display: `Delivered on ${dateLabel(new Date(order.delivered_at), true)}, ${formatISTTime(new Date(order.delivered_at))}`, state: 'delivered', late: false }
    return { display: order.delivery_slot_start ? `Delivered · Slot: ${dateLabel(new Date(order.delivery_slot_start), true)}` : 'Delivered', state: 'delivered', late: false }
  }
  const pending = ['placed', 'accepted', 'picking', 'packed', 'out_for_delivery'].includes(status)
  if (!pending) return { display: null, state: 'none', late: false }
  if (!order.delivery_slot_start || !order.delivery_slot_end) return { display: pending ? order.delivery_slot ?? null : null, state: pending && order.delivery_slot ? 'pending' : 'none', late: false }
  const start = new Date(order.delivery_slot_start), end = new Date(order.delivery_slot_end)
  if (!Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf())) return { display: pending ? order.delivery_slot ?? null : null, state: 'none', late: false }
  const delta = dayDifference(start, now)
  const day = delta === 0 ? 'Today' : delta === 1 ? 'Tomorrow' : `${new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short' }).format(start)} ${dateLabel(start)}`
  const window = `${formatISTTime(start)} - ${formatISTTime(end)}`
  const label = `${day}, ${window}`
  const late = pending && end.getTime() <= now.getTime()
  return { display: late ? `Was due ${label}` : label, state: late ? 'late' : 'pending', late }
}

export function formatDeliveryWindow(start: string | Date, end: string | Date) {
  return `${formatISTTime(new Date(start))} - ${formatISTTime(new Date(end))}`
}

