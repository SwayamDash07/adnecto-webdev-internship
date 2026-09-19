import { createClient } from '@supabase/supabase-js'
import { catalogSelect, mapCatalogProduct, type CatalogCategory, type CatalogRow } from './catalog'
import type { Product } from './types'

function client() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
}

export async function getCatalogProducts(filters?: { categorySlug?: string; productId?: number }) {
  const select = filters?.categorySlug ? catalogSelect().replace('categories(name,slug)', 'categories!inner(name,slug)') : catalogSelect()
  const query = client().from('products').select(select).eq('is_active', true).order('created_at', { ascending: false })
  if (filters?.productId) query.eq('id', filters.productId)
  if (filters?.categorySlug) query.eq('categories.slug', filters.categorySlug)
  const { data, error } = await query
  if (error) throw new Error(`Catalog query failed: ${error.message}`)
  return (data ?? []).map(row => mapCatalogProduct(row as unknown as CatalogRow))
}

export async function getCatalogProduct(id: number) {
  const products = await getCatalogProducts({ productId: id })
  return products[0] ?? null
}

export async function getCatalogCategories(): Promise<CatalogCategory[]> {
  const { data, error } = await client().from('categories').select('id,name,slug').order('name')
  if (error) throw new Error(`Category query failed: ${error.message}`)
  return (data ?? []) as CatalogCategory[]
}

export type { Product }
