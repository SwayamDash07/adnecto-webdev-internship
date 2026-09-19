import type { Address, CartLine, Order, Product } from '@/lib/types'

export type CheckoutDraft = { address: Address; slot: string; instructions: string; payment: string; contactless: boolean; substituteUnavailable: boolean; lines: CartLine[] }

export type ProductFilter = { query?: string; category?: string; brand?: string; minPrice?: number; maxPrice?: number; rating?: number; availability?: boolean; sort?: 'relevance' | 'price-low' | 'price-high' | 'rating' }

export function filterProducts(products: Product[], filters: ProductFilter) {
  const result = products.filter(product => {
    const haystack = `${product.name} ${product.brand ?? ''} ${product.category} ${product.sku ?? ''} ${product.barcode ?? ''}`.toLowerCase()
    return (!filters.query || haystack.includes(filters.query.toLowerCase())) && (!filters.category || product.category === filters.category) && (!filters.brand || product.brand === filters.brand) && (!filters.minPrice || product.price >= filters.minPrice) && (!filters.maxPrice || product.price <= filters.maxPrice) && (!filters.rating || product.rating >= filters.rating) && (!filters.availability || product.stock > 0)
  })
  return [...result].sort((a, b) => filters.sort === 'price-low' ? a.price - b.price : filters.sort === 'price-high' ? b.price - a.price : filters.sort === 'rating' ? b.rating - a.rating : b.reviews - a.reviews)
}

export function calculateCart(lines: CartLine[]) {
  const subtotal = lines.reduce((total, line) => total + line.product.price * line.quantity, 0)
  const delivery = subtotal >= 499 ? 0 : 49
  const packing = lines.length ? 19 : 0
  const discount = subtotal >= 3000 ? Math.round(subtotal * 0.1) : 0
  return { subtotal, delivery, packing, discount, total: subtotal + delivery + packing - discount }
}

export function createDemoOrder(): Order { return { id: `#CL-${10500 + Math.floor(Math.random() * 100)}`, customer: 'Priya Sharma', total: '₹2,499', status: 'Placed', location: 'Bandra West, Mumbai' } }
