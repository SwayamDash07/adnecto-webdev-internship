export type CheckoutAddressRecord = { id: number; label: string; line1: string; city: string; postal_code: string }

export type DeliverySlotRecord = { id?: number | string; starts_at: string; ends_at: string; capacity: number; label?: string; day?: string }

export type CheckoutDeliveryOptions = { standard: DeliverySlotRecord | null; express: DeliverySlotRecord | null }

export type CheckoutOrderReceipt = { order_id: number; delivery_slot: string; delivery_slot_start: string; delivery_slot_end: string; delivery_speed: 'standard' | 'express'; express_fee: number; total: number }

export type ResolvedCheckoutItem = { product_id: number; sku?: string; name: string; quantity: number; substitute: boolean }

export type RazorpayOrderResponse = { keyId?: string; razorpayOrderId?: string; amount?: number; currency?: string; error?: string }
