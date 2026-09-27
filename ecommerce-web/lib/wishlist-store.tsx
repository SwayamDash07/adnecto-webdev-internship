'use client'
import { useEffect, useSyncExternalStore } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Product } from '@/lib/types'

const STORAGE_KEY = 'cartly-wishlist'
const EMPTY_WISHLIST = new Set<number>()
let ids = new Set<number>()
let ready = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())
function save() { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids])) }

export const wishlistStore = {
  getSnapshot: () => ids,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) },
  hydrate: async () => {
    if (typeof window === 'undefined' || ready) return
    try { ids = new Set(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')) } catch { ids = new Set() }
    ready = true; emit()
    const client = createSupabaseBrowserClient(); if (!client) return
    const { data: { user } } = await client.auth.getUser(); if (!user) return
    const { data } = await client.from('wishlists').select('product_id').eq('user_id', user.id)
    if (data?.length) { ids = new Set(data.map(row => row.product_id)); save(); emit() }
  },
  toggle: async (product: Product) => {
    const isSaved = ids.has(product.id)
    ids = new Set(ids)
    if (isSaved) ids.delete(product.id); else ids.add(product.id)
    save(); emit()
    const client = createSupabaseBrowserClient(); if (!client) return
    const { data: { user } } = await client.auth.getUser(); if (!user) return
    const { error } = isSaved ? await client.from('wishlists').delete().eq('user_id', user.id).eq('product_id', product.id) : await client.from('wishlists').upsert({ user_id: user.id, product_id: product.id })
    if (error) { ids = new Set(ids); if (isSaved) ids.add(product.id); else ids.delete(product.id); save(); emit() }
  }
}

export function useWishlist() {
  const saved = useSyncExternalStore(wishlistStore.subscribe, wishlistStore.getSnapshot, () => EMPTY_WISHLIST)
  useEffect(() => { void wishlistStore.hydrate() }, [])
  return { saved, toggle: wishlistStore.toggle }
}
