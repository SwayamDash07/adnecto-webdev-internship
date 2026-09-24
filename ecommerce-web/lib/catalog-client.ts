'use client'

import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { catalogSelect, mapCatalogProduct, type CatalogCategory, type CatalogRow } from './catalog'
import type { Product } from './types'

export async function fetchCatalogProducts(): Promise<Product[]> {
  const client = createSupabaseBrowserClient()
  if (!client) return []
  const [{ data, error }, { data: availability, error: availabilityError }] = await Promise.all([
    client.from('products').select(catalogSelect()).eq('is_active', true).order('created_at', { ascending: false }).range(0, 99),
    client.from('catalog_product_availability').select('product_id,in_stock'),
  ])
  if (error) throw new Error(error.message)
  if (availabilityError) throw new Error(availabilityError.message)
  const availabilityById = new Map(((availability ?? []) as { product_id: number; in_stock: boolean }[]).map(row => [Number(row.product_id), row.in_stock ? 1 : 0]))
  return (data ?? []).map(row => mapCatalogProduct(row as unknown as CatalogRow, availabilityById.get(Number((row as unknown as { id: number }).id)) ?? 0))
}

export async function fetchCatalogCategories(): Promise<CatalogCategory[]> {
  const client = createSupabaseBrowserClient()
  if (!client) return []
  const { data, error } = await client.from('categories').select('id,name,slug,parent_id,sort_order').order('sort_order').order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as CatalogCategory[]
}
