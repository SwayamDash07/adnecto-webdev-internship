export type BackendOrderStatus = 'placed' | 'accepted' | 'picking' | 'packed' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned' | 'refunded'

const transitions: Record<BackendOrderStatus, BackendOrderStatus[]> = {
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

export function canTransitionOrder(from: BackendOrderStatus, to: BackendOrderStatus) {
  return transitions[from].includes(to)
}

export function reservationDelta(currentStock: number, reservedStock: number, quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, available: currentStock - reservedStock }
  const available = currentStock - reservedStock
  return { ok: available >= quantity, available }
}
