export type AdminOrder = { order_id: number; customer_name: string; customer_email: string; total: number; status: string; created_at: string; delivery_slot: string | null; delivery_slot_start:string|null; delivery_slot_end:string|null; delivered_at:string|null; address_line: string; item_count: number; delivery_speed?: string; express_fee?: number }

export type AdminOrderSort = 'newest' | 'oldest' | 'highest'
