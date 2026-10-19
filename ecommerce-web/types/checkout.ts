export type CheckoutAddressRecord = { id: number; label: string; line1: string; city: string; postal_code: string }

export type DeliverySlotRecord = { id?: number | string; starts_at: string; ends_at: string; capacity: number; label?: string; day?: string }

export type ResolvedCheckoutItem = { product_id: number; sku?: string; name: string; quantity: number; substitute: boolean }

export type RazorpayOrderResponse = { keyId?: string; razorpayOrderId?: string; amount?: number; currency?: string; error?: string }
