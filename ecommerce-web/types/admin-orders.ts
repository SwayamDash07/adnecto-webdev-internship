export type AdminOrder = { order_id: number; customer_name: string; customer_email: string; total: number; status: string; created_at: string; delivery_slot: string | null; address_line: string; item_count: number }

export type AdminOrderSort = 'newest' | 'oldest' | 'highest'
