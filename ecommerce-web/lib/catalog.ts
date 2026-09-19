import type { Product } from '@/lib/types'

export type CatalogCategory = { id: number; name: string; slug: string }

export type CatalogRow = {
  id: number
  name: string
  sku: string | null
  barcode: string | null
  description: string | null
  mrp: number
  selling_price: number
  rating: number
  review_count: number
  gst: number
  hsn: string | null
  is_active?: boolean
  country_of_origin: string | null
  attributes: Record<string, unknown> | null
  categories: { name: string; slug: string } | { name: string; slug: string }[] | null
  brands: { name: string } | { name: string }[] | null
  product_images: { storage_path: string; alt_text: string | null; sort_order: number }[] | null
  inventory: { current_stock: number } | { current_stock: number }[] | null
}

function relation<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] ?? null : value }

export function mapCatalogProduct(row: CatalogRow): Product {
  const category = relation(row.categories)
  const brand = relation(row.brands)
  const inventory = relation(row.inventory)
  const attributes = row.attributes ?? {}
  const images = [...(row.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const details = {
    material: typeof attributes.material === 'string' ? attributes.material : undefined,
    warranty: typeof attributes.warranty === 'string' ? attributes.warranty : undefined,
    expiry: typeof attributes.expiry === 'string' ? attributes.expiry : undefined,
    origin: row.country_of_origin ?? undefined,
    packSize: typeof attributes.packSize === 'string' ? attributes.packSize : undefined,
    highlights: Array.isArray(attributes.highlights) ? attributes.highlights.filter((item): item is string => typeof item === 'string') : undefined,
  }
  return {
    id: row.id,
    name: row.name,
    category: category?.name ?? 'Uncategorized',
    price: Number(row.selling_price),
    oldPrice: Number(row.mrp),
    rating: Number(row.rating ?? 0),
    reviews: Number(row.review_count ?? 0),
    badge: typeof attributes.badge === 'string' ? attributes.badge : 'Available',
    color: typeof attributes.color === 'string' ? attributes.color : 'blue',
    emoji: typeof attributes.emoji === 'string' ? attributes.emoji : '▧',
    imageUrl: images[0]?.storage_path,
    gallery: images.slice(1).map(image => image.storage_path),
    details,
    stock: Number(inventory?.current_stock ?? 0),
    sku: row.sku ?? undefined,
    barcode: row.barcode ?? undefined,
    brand: brand?.name,
    gst: Number(row.gst ?? 0),
    hsn: row.hsn ?? undefined,
    description: row.description ?? undefined,
  }
}

export function categoryFromSlug(slug: string) {
  return slug.trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')
}

export function catalogSelect() {
  return 'id,name,sku,barcode,description,mrp,selling_price,rating,review_count,gst,hsn,country_of_origin,attributes,is_active,categories(name,slug),brands(name),product_images(storage_path,alt_text,sort_order),inventory(current_stock)'
}
