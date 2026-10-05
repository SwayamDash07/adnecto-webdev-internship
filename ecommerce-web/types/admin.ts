export type AdminProduct = { product_id: number; product_name: string; sku: string | null; category_name: string | null; brand_name: string | null; selling_price: number; current_stock: number; is_active: boolean }

export type AdminCoupon = { coupon_id: number; code: string; kind: string; value: number; starts_at: string | null; ends_at: string | null; active: boolean }

export type AdminTicket = { ticket_id: number; customer_name: string; subject: string; message: string; priority: string; status: string; created_at: string }

export type PurchaseOrder = { purchase_order_id: number; supplier_name: string; status: string; created_at: string; item_count: number }

export type AdminCustomer = { customer_id: string; customer_name: string; email: string; phone: string | null; order_count: number; lifetime_spend: number; joined_at: string }
