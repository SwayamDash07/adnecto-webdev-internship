export const orderStatuses = ['placed', 'accepted', 'picking', 'packed', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded'] as const

export type OrderStatus = (typeof orderStatuses)[number]

const nextStatuses: Record<OrderStatus, readonly OrderStatus[]> = {
  placed: ['accepted', 'cancelled'],
  accepted: ['picking', 'cancelled'],
  picking: ['packed'],
  packed: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: ['returned'],
  cancelled: ['refunded'],
  returned: ['refunded'],
  refunded: [],
}

export function allowedOrderStatuses(status: string): readonly string[] {
  return [status, ...(nextStatuses[status as OrderStatus] ?? [])]
}

export const orderPageSize = 8
