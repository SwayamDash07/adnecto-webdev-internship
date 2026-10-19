export type Recent = { id: number; customer: string; total: number; status: string; created_at: string; delivery_slot_start?:string|null; delivery_slot_end?:string|null }

export type LateOrder = Recent & { last_reminded_at: string | null; open_complaint_id: number | null }

export type TopProduct = { product_id: number; product_name: string; units_sold: number; revenue: number }

export type LowStock = { product_id: number; product_name: string; current_stock: number; reserved_stock?: number; reorder_level: number }

export type SalesPoint = { day: string; revenue: number }
