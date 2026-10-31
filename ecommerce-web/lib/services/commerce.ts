import type { Address, CartLine, Product } from '@/types/catalog'
import { EXPRESS_DELIVERY_FEE, FREE_DELIVERY_THRESHOLD, PACKAGING_FEE, STANDARD_DELIVERY_FEE } from '@/lib/support-config'

export type CheckoutDraft = { address: Address; slot: string; instructions: string; payment: string; contactless: boolean; substituteUnavailable: boolean; lines: CartLine[] }

export type ProductFilter = { query?: string; category?: string; brand?: string; minPrice?: number; maxPrice?: number; minWeight?: number; maxWeight?: number; minDiscount?: number; rating?: number; availability?: boolean; organic?: boolean; vegetarian?: boolean; glutenFree?: boolean; sort?: 'relevance' | 'price-low' | 'price-high' | 'rating' | 'discount' }

function fuzzyMatch(value: string, query: string) {
  const normalized = value.toLowerCase().trim()
  const target = query.toLowerCase().trim()
  if (!target) return true
  if (normalized.includes(target)) return true
  const words = normalized.split(/\s+/)
  return words.some(word => {
    const distance = Array.from({ length: target.length + 1 }, (_, index) => index)
    for (let i = 1; i <= word.length; i += 1) {
      let diagonal = distance[0]
      distance[0] = i
      for (let j = 1; j <= target.length; j += 1) {
        const above = distance[j]
        distance[j] = word[i - 1] === target[j - 1] ? diagonal : 1 + Math.min(diagonal, distance[j], distance[j - 1])
        diagonal = above
      }
    }
    return distance[target.length] <= Math.max(1, Math.floor(target.length / 4))
  })
}

export function filterProducts(products: Product[], filters: ProductFilter) {
  const result = products.filter(product => {
    const haystack = `${product.name} ${product.brand ?? ''} ${product.category} ${product.sku ?? ''} ${product.barcode ?? ''}`.toLowerCase()
    const discount = product.oldPrice > 0 ? ((product.oldPrice - product.price) / product.oldPrice) * 100 : 0
    return (!filters.query || fuzzyMatch(haystack, filters.query)) && (!filters.category || product.category === filters.category) && (!filters.brand || product.brand === filters.brand) && (!filters.minPrice || product.price >= filters.minPrice) && (!filters.maxPrice || product.price <= filters.maxPrice) && (!filters.minWeight || (product.weight ?? 0) >= filters.minWeight) && (!filters.maxWeight || (product.weight ?? 0) <= filters.maxWeight) && (!filters.minDiscount || discount >= filters.minDiscount) && (!filters.rating || product.rating >= filters.rating) && (!filters.availability || product.stock > 0) && (!filters.organic || product.isOrganic) && (!filters.vegetarian || product.isVegetarian) && (!filters.glutenFree || product.isGlutenFree)
  })
  return [...result].sort((a, b) => filters.sort === 'price-low' ? a.price - b.price : filters.sort === 'price-high' ? b.price - a.price : filters.sort === 'rating' ? b.rating - a.rating : filters.sort === 'discount' ? ((b.oldPrice - b.price) / Math.max(1, b.oldPrice)) - ((a.oldPrice - a.price) / Math.max(1, a.oldPrice)) : b.reviews - a.reviews)
}

export function calculateCartTotals(lines: CartLine[], options: { couponDiscount?: number; express?: boolean } = {}) {
  const subtotal = lines.reduce((total, line) => total + line.product.price * line.quantity, 0)
  const mrpSubtotal = lines.reduce((total, line) => total + line.product.oldPrice * line.quantity, 0)
  const mrpDiscount = lines.reduce((total, line) => total + Math.max(0, line.product.oldPrice - line.product.price) * line.quantity, 0)
  const delivery = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE
  const packing = lines.length ? PACKAGING_FEE : 0
  const discount = Math.max(0, options.couponDiscount ?? 0)
  const gst = Math.round(lines.reduce((total, line) => total + (line.product.price * line.quantity * (line.product.gst ?? 0)) / 100, 0) * 100) / 100
  const expressFee = options.express && lines.length ? EXPRESS_DELIVERY_FEE : 0
  return { subtotal, mrpSubtotal, mrpDiscount, delivery, packing, discount, gst, expressFee, total: Math.max(0, subtotal + gst + delivery + packing + expressFee - discount) }
}

export function calculateCart(lines: CartLine[]) { return calculateCartTotals(lines) }
