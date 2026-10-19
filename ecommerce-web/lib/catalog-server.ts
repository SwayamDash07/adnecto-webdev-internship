import 'server-only'
import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { catalogSelect, mapCatalogProduct, type CatalogCategory, type CatalogRow } from './catalog'
import type { Product } from '@/types/catalog'

function client() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
}

type CatalogFilters = { categorySlug?: string; productId?: number; productIds?: number[] }

async function fetchCatalogProducts(filters?: CatalogFilters) {
  if (filters?.productIds && filters.productIds.length === 0) return []
  const supabase = client()
  const select = filters?.categorySlug ? catalogSelect().replace('categories(name,slug)', 'categories!inner(name,slug)') : catalogSelect()
  const query = supabase.from('products').select(select).eq('is_active', true).order('created_at', { ascending: false })
  if (filters?.productId) query.eq('id', filters.productId)
  if (filters?.productIds) query.in('id', filters.productIds)
  if (filters?.categorySlug) query.eq('categories.slug', filters.categorySlug)
  const [{ data, error }, { data: availability, error: availabilityError }] = await Promise.all([
    query.range(0, 99),
    filters?.productIds
      ? supabase.from('catalog_product_availability').select('product_id,in_stock').in('product_id', filters.productIds)
      : supabase.from('catalog_product_availability').select('product_id,in_stock'),
  ])
  if (error) throw new Error(`Catalog query failed: ${error.message}`)
  if (availabilityError) throw new Error(`Catalog availability query failed: ${availabilityError.message}`)
  const availabilityById = new Map(((availability ?? []) as { product_id: number; in_stock: boolean }[]).map(row => [Number(row.product_id), row.in_stock ? 1 : 0]))
  return (data ?? []).map(row => mapCatalogProduct(row as unknown as CatalogRow, availabilityById.get(Number((row as unknown as { id: number }).id)) ?? 0))
}

const cachedCatalogProducts = unstable_cache(
  async (filters: CatalogFilters = {}) => fetchCatalogProducts(filters),
  ['public-catalog-products-v1'],
  { revalidate: 60, tags: ['catalog-products'] },
)

export function getCatalogProducts(filters?: CatalogFilters) {
  // Cart snapshots must read current availability; public product pages can use
  // a short shared catalog cache because they contain no account-specific data.
  if (filters?.productIds) return fetchCatalogProducts(filters)
  return cachedCatalogProducts(filters ?? {})
}

export async function getCatalogProduct(id: number) {
  const products = await getCatalogProducts({ productId: id })
  return products[0] ?? null
}

const cachedCatalogCategories = unstable_cache(async (): Promise<CatalogCategory[]> => {
  const { data, error } = await client().from('categories').select('id,name,slug,parent_id,sort_order').order('sort_order').order('name')
  if (error) throw new Error(`Category query failed: ${error.message}`)
  return (data ?? []) as CatalogCategory[]
}, ['public-catalog-categories-v1'], { revalidate: 60, tags: ['catalog-categories'] })

export function getCatalogCategories() { return cachedCatalogCategories() }

export type { Product }
