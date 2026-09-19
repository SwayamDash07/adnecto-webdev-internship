export type Product = {
  id: number
  name: string
  category: string
  price: number
  oldPrice: number
  rating: number
  reviews: number
  badge: string
  color: string
  emoji: string
  imageUrl?: string
  gallery?: string[]
  details?: { material?: string; warranty?: string; expiry?: string; origin?: string; packSize?: string; highlights?: string[] }
  stock: number
  sku?: string
  barcode?: string
  brand?: string
  gst?: number
  hsn?: string
  description?: string
  variants?: string[]
}

export type Address = { id: number; label: string; recipient: string; line: string; city: string; postalCode: string; selected?: boolean }

export type CartLine = { product: Product; quantity: number; variant?: string }

export type OrderStatus = 'Placed' | 'Accepted' | 'Picking' | 'Packed' | 'Out for delivery' | 'Delivered' | 'Cancelled' | 'Returned' | 'Refunded'

export type Order = {
  id: string
  customer: string
  total: string
  status: OrderStatus
  location: string
}
