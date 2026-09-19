'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { CartLine, Product } from '@/lib/types'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

type Listener = () => void
type State = { lines: CartLine[]; ready: boolean }
const EMPTY_STATE: State = { lines: [], ready: false }
const STORAGE_KEY = 'cartly-guest-cart'
let state: State = EMPTY_STATE
const listeners = new Set<Listener>()
const emit = () => { listeners.forEach(listener => listener()) }
const saveGuest = () => { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.lines)) }
const available = (product: Product) => Math.max(0, product.stock)

function key(line: Pick<CartLine, 'product' | 'variant'>) { return `${line.product.id}:${line.variant ?? ''}` }

export const cartStore = {
  getSnapshot: () => state,
  subscribe: (listener: Listener) => { listeners.add(listener); return () => listeners.delete(listener) },
  hydrate: () => {
    if (typeof window === 'undefined' || state.ready) return
    try { state = { lines: JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]'), ready: true } } catch { state = { lines: [], ready: true } }
    emit()
  },
  add: (product: Product, quantity = 1, variant?: string) => {
    const existing = state.lines.find(line => key(line) === key({ product, variant }))
    const nextQuantity = Math.min(available(product), (existing?.quantity ?? 0) + quantity)
    if (!nextQuantity) return false
    state = { ...state, lines: existing ? state.lines.map(line => key(line) === key({ product, variant }) ? { ...line, quantity: nextQuantity } : line) : [...state.lines, { product, quantity: nextQuantity, variant }] }
    saveGuest(); emit(); return true
  },
  update: (lineKey: string, quantity: number) => {
    state = { ...state, lines: state.lines.map(line => key(line) === lineKey ? { ...line, quantity: Math.min(available(line.product), Math.max(0, quantity)) } : line).filter(line => line.quantity > 0) }
    saveGuest(); emit()
  },
  remove: (lineKey: string) => { state = { ...state, lines: state.lines.filter(line => key(line) !== lineKey) }; saveGuest(); emit() },
  clear: () => { state = { ...state, lines: [] }; saveGuest(); emit() },
  mergeForUser: async () => {
    const supabase = createSupabaseBrowserClient(); if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return
    const { data } = await supabase.from('cart').select('product_id, quantity, variant').eq('user_id', user.id)
    const remote = (data ?? []).map(row => { const product = state.lines.find(line => line.product.id === row.product_id)?.product; return product ? { product, quantity: row.quantity, variant: row.variant } : null }).filter(Boolean) as CartLine[]
    const merged = [...remote]
    for (const local of state.lines) { const found = merged.find(line => key(line) === key(local)); if (found) found.quantity = Math.min(available(found.product), found.quantity + local.quantity); else merged.push(local) }
    state = { ...state, lines: merged }; saveGuest(); emit()
    await supabase.from('cart').delete().eq('user_id', user.id)
    if (merged.length) await supabase.from('cart').insert(merged.map(line => ({ user_id: user.id, product_id: line.product.id, variant: line.variant ?? null, quantity: line.quantity })))
  }
}

export function useCart() {
  const snapshot = useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, () => EMPTY_STATE)
  useEffect(() => { cartStore.hydrate() }, [])
  return { ...snapshot, totalQuantity: snapshot.lines.reduce((sum, line) => sum + line.quantity, 0), lineKey: key, clear: cartStore.clear }
}
