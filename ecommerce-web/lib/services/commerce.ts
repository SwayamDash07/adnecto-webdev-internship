import type { Address, CartLine, Product } from '@/lib/types'

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

export function calculateCart(lines: CartLine[]) {
  const subtotal = lines.reduce((total, line) => total + line.product.price * line.quantity, 0)
  const delivery = subtotal >= 499 ? 0 : 49
  const packing = lines.length ? 19 : 0
  const discount = subtotal >= 3000 ? Math.round(subtotal * 0.1) : 0
  const gst = lines.reduce((total, line) => total + (line.product.price * line.quantity * (line.product.gst ?? 0)) / 100, 0)
  return { subtotal, delivery, packing, discount, gst, total: Math.max(0, subtotal + gst + delivery + packing - discount) }
}
