import 'server-only'
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCatalogProducts } from '@/lib/catalog-server'
import type { CartLine } from '@/types/catalog'

type CartRow = { product_id: number; variant: string | null; quantity: number; available_stock: number }

const loadCartRows = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { isAuthenticated: false, rows: [] as CartRow[] }

  const { data, error } = await supabase.rpc('get_cart_items', { p_session_id: null })
  if (error) throw new Error(`Could not load cart: ${error.message}`)
  return { isAuthenticated: true, rows: (data ?? []) as CartRow[] }
})

export const getCurrentCartCount = cache(async () => {
  const { rows } = await loadCartRows()
  return rows.reduce((total, row) => total + Math.max(0, Number(row.quantity) || 0), 0)
})

export type ServerCartSnapshot = { isAuthenticated: boolean; lines: CartLine[]; totalQuantity: number }

export const getCurrentCartSnapshot = cache(async (): Promise<ServerCartSnapshot> => {
  const { isAuthenticated, rows } = await loadCartRows()
  if (!rows.length) return { isAuthenticated, lines: [], totalQuantity: 0 }

  const ids = [...new Set(rows.map(row => Number(row.product_id)).filter(Number.isFinite))]
  const products = await getCatalogProducts({ productIds: ids })
  const byId = new Map(products.map(product => [product.id, product]))
  const lines = rows.flatMap(row => {
    const product = byId.get(Number(row.product_id))
    if (!product) return []
    const stock = Math.max(0, Number(row.available_stock) || 0)
    const quantity = Math.min(Math.max(0, Number(row.quantity) || 0), stock, 99)
    return quantity > 0 ? [{
      product: { ...product, stock, stockIsAvailabilityOnly: false },
      quantity,
      variant: row.variant || undefined,
    }] : []
  })
  return { isAuthenticated, lines, totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0) }
})
