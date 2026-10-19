'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { CartLine, Product } from '@/types/catalog'
import { fetchCatalogProducts } from '@/lib/catalog-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

type Listener = () => void
type State = { lines: CartLine[]; ready: boolean }
type CartRpcResult = { ok: boolean; error?: string; available?: number; quantity?: number; product_id?: number }
type CartResponse = { product_id: number; variant: string | null; quantity: number; available_stock: number }
export type CartChangeResult = { ok: boolean; error?: string; available: number; previousQuantity: number; quantity: number }
const EMPTY_STATE: State = { lines: [], ready: false }
const STORAGE_KEY = 'cartly-guest-cart'
const SESSION_KEY = 'cartly-cart-session'
export const MAX_CART_QUANTITY = 99
let state: State = EMPTY_STATE
let syncListenersInstalled = false
let refreshInFlight: Promise<void> | null = null
const listeners = new Set<Listener>()
const emit = () => { listeners.forEach(listener => listener()) }
const saveGuest = () => { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.lines)) }
function key(line: Pick<CartLine, 'product' | 'variant'>) { return `${line.product.id}:${line.variant ?? ''}` }

function getSessionId() {
  if (typeof window === 'undefined') return ''
  let id = window.localStorage.getItem(SESSION_KEY)
  if (!id) { id = window.crypto.randomUUID(); window.localStorage.setItem(SESSION_KEY, id) }
  return id
}

export function getGuestCartSessionId() {
  return getSessionId()
}

function readLocalLines(): CartLine[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]') as CartLine[]
    return stored.map(line => line.product.stockIsAvailabilityOnly === undefined && line.product.stock === 1
      ? { ...line, product: { ...line.product, stockIsAvailabilityOnly: true } }
      : line)
  } catch { return [] }
}

export function readGuestCartSnapshot() {
  return typeof window === 'undefined' ? [] : readLocalLines()
}

function setLines(lines: CartLine[]) {
  state = { ...state, lines }
  try { saveGuest() } catch { /* Keep the in-memory cart usable if storage is unavailable. */ }
  emit()
}

async function rpcSet(product: Product, quantity: number, variant?: string): Promise<CartRpcResult> {
  const client = createSupabaseBrowserClient()
  if (!client) return { ok: false, error: 'CART_SERVICE_UNAVAILABLE', available: 0, quantity: 0 }
  const { data, error } = await client.rpc('set_cart_item_quantity', {
    p_product_id: product.id,
    p_quantity: quantity,
    p_variant: variant ?? '',
    p_session_id: getSessionId(),
  })
  if (error) return { ok: false, error: error.message, available: product.stock, quantity: 0 }
  return data as CartRpcResult
}

function updateLineFromServer(product: Product, quantity: number, available: number, variant?: string) {
  const updatedProduct = { ...product, stock: Math.max(0, available), stockIsAvailabilityOnly: false }
  const match = { product: updatedProduct, quantity, variant }
  const itemKey = key(match)
  const existing = state.lines.find(line => key(line) === itemKey)
  setLines(quantity <= 0
    ? state.lines.filter(line => key(line) !== itemKey)
    : existing
      ? state.lines.map(line => key(line) === itemKey ? match : line)
      : [...state.lines, match])
}

async function fetchRemoteLines(): Promise<{ products: Product[]; rows: CartResponse[] } | null> {
  const client = createSupabaseBrowserClient()
  if (!client) return null
  const [{ data, error }, products] = await Promise.all([
    client.rpc('get_cart_items', { p_session_id: getSessionId() }),
    fetchCatalogProducts(),
  ])
  if (error) throw new Error(error.message)
  return { products, rows: (data ?? []) as CartResponse[] }
}

async function refreshFromServer() {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    const remote = await fetchRemoteLines()
    if (!remote) return
    const productsById = new Map(remote.products.map(product => [product.id, product]))
    const priorByKey = new Map(state.lines.map(line => [key(line), line]))
    const remoteKeys = new Set(remote.rows.map(row => `${row.product_id}:${row.variant ?? ''}`))

    // Migrate pre-RPC guest carts into the validated, expiring server cart once.
    const missingLocal = state.lines.filter(line => !remoteKeys.has(key(line)))
    if (missingLocal.length) {
      for (const line of missingLocal) {
        const result = await rpcSet(line.product, line.quantity, line.variant)
        if (result.ok) remote.rows.push({ product_id: line.product.id, variant: line.variant ?? '', quantity: result.quantity ?? line.quantity, available_stock: result.available ?? line.product.stock })
        else if ((result.available ?? 0) > 0) remote.rows.push({ product_id: line.product.id, variant: line.variant ?? '', quantity: Math.min(line.quantity, result.available ?? 0), available_stock: result.available ?? 0 })
      }
    }

    const lines: CartLine[] = []
    for (const row of remote.rows) {
      const product = productsById.get(Number(row.product_id)) ?? priorByKey.get(`${row.product_id}:${row.variant ?? ''}`)?.product
      if (!product) continue
      const available = Math.max(0, Number(row.available_stock) || 0)
      const quantity = Math.min(Number(row.quantity), available, MAX_CART_QUANTITY)
      const variant = row.variant || undefined
      if (quantity !== row.quantity) await rpcSet(product, quantity, variant)
      if (quantity <= 0) continue
      const line = { product: { ...product, stock: available, stockIsAvailabilityOnly: false }, quantity, variant }
      lines.push(line)
    }
    setLines(lines)
  })().catch(() => { /* Keep the local snapshot if the cart service is temporarily unavailable. */ }).finally(() => { refreshInFlight = null })
  return refreshInFlight
}

function installSyncListeners() {
  if (syncListenersInstalled || typeof window === 'undefined') return
  syncListenersInstalled = true
  window.addEventListener('focus', () => { void refreshFromServer() })
  window.setInterval(() => { if (document.visibilityState === 'visible') void refreshFromServer() }, 5 * 60 * 1000)
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) {
      state = { ...state, lines: readLocalLines() }
      emit()
      void refreshFromServer()
    }
  })
}

export const cartStore = {
  getSnapshot: () => state,
  subscribe: (listener: Listener) => { listeners.add(listener); return () => listeners.delete(listener) },
  hydrate: () => {
    if (typeof window === 'undefined') return
    if (!state.ready) { state = { lines: readLocalLines(), ready: true }; emit() }
    installSyncListeners()
    void refreshFromServer()
  },
  add: async (product: Product, quantity = 1, variant?: string) => (await cartStore.addValidated(product, quantity, variant)).ok,
  addValidated: async (product: Product, quantity = 1, variant?: string): Promise<CartChangeResult> => {
    const existing = state.lines.find(line => key(line) === key({ product, variant }))
    const previousQuantity = existing?.quantity ?? 0
    const result = await rpcSet(product, previousQuantity + quantity, variant)
    if (!result.ok) return { ok: false, error: result.error, available: result.available ?? product.stock, previousQuantity, quantity: result.quantity ?? previousQuantity }
    updateLineFromServer(product, result.quantity ?? previousQuantity + quantity, result.available ?? product.stock, variant)
    return { ok: true, available: result.available ?? product.stock, previousQuantity, quantity: result.quantity ?? previousQuantity + quantity }
  },
  setQuantityValidated: async (product: Product, quantity: number, variant?: string): Promise<CartChangeResult> => {
    const existing = state.lines.find(line => key(line) === key({ product, variant }))
    const previousQuantity = existing?.quantity ?? 0
    const result = await rpcSet(product, quantity, variant)
    if (!result.ok) return { ok: false, error: result.error, available: result.available ?? product.stock, previousQuantity, quantity: result.quantity ?? previousQuantity }
    updateLineFromServer(product, result.quantity ?? quantity, result.available ?? product.stock, variant)
    return { ok: true, available: result.available ?? product.stock, previousQuantity, quantity: result.quantity ?? quantity }
  },
  update: async (lineKey: string, quantity: number) => {
    const line = state.lines.find(item => key(item) === lineKey)
    return line ? cartStore.setQuantityValidated(line.product, quantity, line.variant) : { ok: false, available: 0, previousQuantity: 0, quantity: 0, error: 'CART_LINE_NOT_FOUND' } as CartChangeResult
  },
  updateValidated: async (line: CartLine, quantity: number) => cartStore.setQuantityValidated(line.product, quantity, line.variant),
  remove: async (lineKey: string) => {
    const line = state.lines.find(item => key(item) === lineKey)
    if (!line) return
    const result = await cartStore.setQuantityValidated(line.product, 0, line.variant)
    if (!result.ok) return
  },
  clear: () => {
    for (const line of state.lines) void rpcSet(line.product, 0, line.variant)
    setLines([])
  },
  setProductAvailability: (productId: number, available: number) => {
    setLines(state.lines.map(line => line.product.id === productId ? { ...line, product: { ...line.product, stock: Math.max(0, available), stockIsAvailabilityOnly: false } } : line))
  },
  refresh: refreshFromServer,
  replaceFromServer: (lines: CartLine[]) => { state = { lines, ready: true }; emit() },
  replaceGuestSnapshot: (lines: CartLine[]) => { state = { lines, ready: true }; saveGuest(); emit() },
  mergeForUser: async () => {
    const client = createSupabaseBrowserClient()
    if (!client) return
    const { data: { user } } = await client.auth.getUser()
    if (!user) return
    const guestLines = [...state.lines]
    const sessionId = getSessionId()
    await client.rpc('clear_guest_cart', { p_session_id: sessionId })
    const remote = await fetchRemoteLines()
    const combined = new Map<string, CartLine>()
    const productsById = new Map((remote?.products ?? []).map(product => [product.id, product]))
    for (const row of remote?.rows ?? []) {
      const product = productsById.get(Number(row.product_id))
      if (product) combined.set(`${row.product_id}:${row.variant ?? ''}`, { product: { ...product, stock: row.available_stock, stockIsAvailabilityOnly: false }, quantity: row.quantity, variant: row.variant || undefined })
    }
    for (const line of guestLines) {
      const itemKey = key(line)
      const existing = combined.get(itemKey)
      const wanted = Math.min(MAX_CART_QUANTITY, (existing?.quantity ?? 0) + line.quantity)
      const product = existing?.product ?? line.product
      let result = await rpcSet(product, wanted, line.variant)
      if (!result.ok && (result.error === 'INSUFFICIENT_STOCK' || result.error === 'MAX_QUANTITY_EXCEEDED') && (result.available ?? 0) > 0) {
        result = await rpcSet(product, Math.min(result.available!, MAX_CART_QUANTITY), line.variant)
      }
      if (result.ok) {
        combined.set(itemKey, { product: { ...product, stock: result.available ?? product.stock, stockIsAvailabilityOnly: false }, quantity: result.quantity ?? wanted, variant: line.variant })
      }
    }
    setLines([...combined.values()])
  },
}

export function useCart() {
  const snapshot = useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, () => EMPTY_STATE)
  useEffect(() => { cartStore.hydrate() }, [])
  return { ...snapshot, totalQuantity: snapshot.lines.reduce((sum, line) => sum + line.quantity, 0), lineKey: key, clear: cartStore.clear }
}
