'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCatalogProducts } from '@/lib/catalog-server'
import type { CartLine } from '@/types/catalog'

export type CartMutationResult = {
  ok: boolean
  error?: string
  available: number
  quantity: number
  lines?: CartLine[]
}

async function loadActionCartLines(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, sessionId?: string) {
  const { data, error } = await supabase.rpc('get_cart_items', { p_session_id: sessionId ?? null })
  if (error) return undefined
  const rows = (data ?? []) as { product_id: number; variant: string | null; quantity: number; available_stock: number }[]
  const products = await getCatalogProducts({ productIds: [...new Set(rows.map(row => Number(row.product_id)))] })
  const byId = new Map(products.map(product => [product.id, product]))
  return rows.flatMap(row => {
    const product = byId.get(Number(row.product_id))
    const quantity = Math.min(Number(row.quantity) || 0, Number(row.available_stock) || 0, 99)
    return product && quantity > 0 ? [{ product: { ...product, stock: Number(row.available_stock) || 0, stockIsAvailabilityOnly: false }, quantity, variant: row.variant || undefined }] : []
  })
}

export async function setCartItemQuantityAction(
  productId: number,
  quantity: number,
  variant?: string,
  sessionId?: string,
): Promise<CartMutationResult> {
  if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity < 0 || quantity > 99) {
    return { ok: false, error: 'INVALID_QUANTITY', available: 0, quantity: 0 }
  }
  if (sessionId !== undefined && (sessionId.length < 8 || sessionId.length > 128)) {
    return { ok: false, error: 'INVALID_CART_SESSION', available: 0, quantity: 0 }
  }
  if (variant !== undefined && (typeof variant !== 'string' || variant.length > 120)) {
    return { ok: false, error: 'INVALID_VARIANT', available: 0, quantity: 0 }
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('set_cart_item_quantity', {
    p_product_id: productId,
    p_quantity: quantity,
    p_variant: variant ?? '',
    p_session_id: sessionId ?? null,
  })
  if (error || !data) return { ok: false, error: 'CART_SERVICE_UNAVAILABLE', available: 0, quantity: 0 }
  const result = data as { ok?: boolean; error?: string; available?: number; quantity?: number }
  if (!result.ok) return { ok: false, error: result.error ?? 'CART_UPDATE_FAILED', available: Number(result.available) || 0, quantity: Number(result.quantity) || 0 }

  revalidatePath('/customer/cart')
  const lines = await loadActionCartLines(supabase, sessionId)
  return { ok: true, available: Number(result.available) || 0, quantity: Number(result.quantity) || 0, lines }
}

type GuestLineInput = { productId: number; quantity: number; variant?: string }

function parseGuestLines(value: unknown): GuestLineInput[] | null {
  if (!Array.isArray(value) || value.length > 200) return null
  const result: GuestLineInput[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') return null
    const line = row as Record<string, unknown>
    const productId = Number(line.productId)
    const quantity = Number(line.quantity)
    const variant = line.variant === undefined || line.variant === null ? '' : String(line.variant)
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > 99 || variant.length > 120) return null
    result.push({ productId, quantity, variant })
  }
  const merged = new Map<string, GuestLineInput>()
  for (const line of result) {
    const key = `${line.productId}:${line.variant ?? ''}`
    const current = merged.get(key)
    merged.set(key, { ...line, quantity: Math.min(99, (current?.quantity ?? 0) + line.quantity) })
  }
  return [...merged.values()]
}

export async function syncGuestCartAction(sessionId: string, rawLines: unknown): Promise<{ lines?: CartLine[]; error?: string }> {
  if (typeof sessionId !== 'string' || sessionId.length < 8 || sessionId.length > 128) return { error: 'INVALID_CART_SESSION' }
  const input = parseGuestLines(rawLines)
  if (!input) return { error: 'INVALID_CART' }

  let products
  try {
    products = await getCatalogProducts({ productIds: [...new Set(input.map(line => line.productId))] })
  } catch {
    return { error: 'CATALOG_UNAVAILABLE' }
  }
  const productIds = new Set(products.map(product => product.id))
  const supabase = await createSupabaseServerClient()
  const mutationResults = await Promise.all(input.filter(line => productIds.has(line.productId)).map(line => supabase.rpc('set_cart_item_quantity', {
    p_product_id: line.productId,
    p_quantity: line.quantity,
    p_variant: line.variant ?? '',
    p_session_id: sessionId,
  })))
  if (mutationResults.some(({ error, data }) => error || !(data as { ok?: boolean } | null)?.ok)) return { error: 'CART_SERVICE_UNAVAILABLE' }

  const lines = await loadActionCartLines(supabase, sessionId)
  if (!lines) return { error: 'CART_SERVICE_UNAVAILABLE' }
  revalidatePath('/customer/cart')
  return { lines }
}
