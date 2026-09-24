import { createClient } from '@supabase/supabase-js'
import { catalogSelect, mapCatalogProduct, type CatalogCategory, type CatalogRow } from './catalog'
import type { Product } from './types'

function client() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
}

export async function getCatalogProducts(filters?: { categorySlug?: string; productId?: number }) {
  const supabase = client()
  const select = filters?.categorySlug ? catalogSelect().replace('categories(name,slug)', 'categories!inner(name,slug)') : catalogSelect()
  const query = supabase.from('products').select(select).eq('is_active', true).order('created_at', { ascending: false })
  if (filters?.productId) query.eq('id', filters.productId)
  if (filters?.categorySlug) query.eq('categories.slug', filters.categorySlug)
  const [{ data, error }, { data: availability, error: availabilityError }] = await Promise.all([
    query.range(0, 99),
    supabase.from('catalog_product_availability').select('product_id,in_stock'),
  ])
  if (error) throw new Error(`Catalog query failed: ${error.message}`)
  if (availabilityError) throw new Error(`Catalog availability query failed: ${availabilityError.message}`)
  const availabilityById = new Map(((availability ?? []) as { product_id: number; in_stock: boolean }[]).map(row => [Number(row.product_id), row.in_stock ? 1 : 0]))
  return (data ?? []).map(row => mapCatalogProduct(row as unknown as CatalogRow, availabilityById.get(Number((row as unknown as { id: number }).id)) ?? 0))
}

export async function getCatalogProduct(id: number) {
  const products = await getCatalogProducts({ productId: id })
  return products[0] ?? null
}

export async function getCatalogCategories(): Promise<CatalogCategory[]> {
  const { data, error } = await client().from('categories').select('id,name,slug,parent_id,sort_order').order('sort_order').order('name')
  if (error) throw new Error(`Category query failed: ${error.message}`)
  return (data ?? []) as CatalogCategory[]
}

export type { Product }
