export type Recent = { id: number; customer: string; total: number; status: string }

export type TopProduct = { product_id: number; product_name: string; units_sold: number; revenue: number }

export type LowStock = { product_id: number; product_name: string; current_stock: number; reorder_level: number }

export type SalesPoint = { day: string; revenue: number }
