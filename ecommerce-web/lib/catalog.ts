import type { Product } from '@/lib/types'

export type CatalogCategory = { id: number; name: string; slug: string; parent_id?: number | null; sort_order?: number }

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
  product_variants?: { id: number; name: string; sku: string | null; price: number; weight: number | null; stock?: number }[] | null
  product_type?: Product['productType']
  weight?: number | null
  ingredients?: string | null
  nutrition?: Record<string, unknown> | null
  is_organic?: boolean
  is_vegetarian?: boolean
  is_gluten_free?: boolean
  video_url?: string | null
}

function relation<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] ?? null : value }

export function mapCatalogProduct(row: CatalogRow, publicStock?: number): Product {
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
    stock: publicStock ?? Number(inventory?.current_stock ?? 0),
    sku: row.sku ?? undefined,
    barcode: row.barcode ?? undefined,
    brand: brand?.name,
    gst: Number(row.gst ?? 0),
    hsn: row.hsn ?? undefined,
    description: row.description ?? undefined,
    variants: row.product_variants?.map(variant => variant.name),
    variantDetails: row.product_variants?.map(variant => ({ id: variant.id, name: variant.name, sku: variant.sku ?? undefined, price: Number(variant.price), weight: variant.weight ?? undefined, ...(variant.stock == null ? {} : { stock: Number(variant.stock) }) })),
    productType: row.product_type,
    weight: row.weight ?? undefined,
    ingredients: row.ingredients ?? undefined,
    nutrition: row.nutrition ?? undefined,
    isOrganic: row.is_organic ?? false,
    isVegetarian: row.is_vegetarian ?? false,
    isGlutenFree: row.is_gluten_free ?? false,
    videoUrl: row.video_url ?? undefined,
  }
}

export function categoryFromSlug(slug: string) {
  return slug.trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')
}

export function catalogSelect() {
  return 'id,name,sku,barcode,description,mrp,selling_price,rating,review_count,gst,hsn,country_of_origin,attributes,is_active,product_type,weight,ingredients,nutrition,is_organic,is_vegetarian,is_gluten_free,video_url,categories(name,slug),brands(name),product_images(storage_path,alt_text,sort_order),product_variants(id,name,sku,price,weight)'
}
