'use client'

import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { catalogSelect, mapCatalogProduct, type CatalogCategory, type CatalogRow } from './catalog'
import type { Product } from './types'

export async function fetchCatalogProducts(): Promise<Product[]> {
  const client = createSupabaseBrowserClient()
  if (!client) return []
  const { data, error } = await client.from('products').select(catalogSelect()).eq('is_active', true).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(row => mapCatalogProduct(row as unknown as CatalogRow))
}

export async function fetchCatalogCategories(): Promise<CatalogCategory[]> {
  const client = createSupabaseBrowserClient()
  if (!client) return []
  const { data, error } = await client.from('categories').select('id,name,slug').order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as CatalogCategory[]
}
