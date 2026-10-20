'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { LateOrder, LowStock, Recent } from '@/types/admin-overview'

export function useAdminOverview(initial: { initialOrders: Recent[]; initialLateOrders: LateOrder[]; initialLowStock: LowStock[]; initialError: string }) {
  const router = useRouter()
  const [orders, setOrders] = useState<Recent[]>(initial.initialOrders)
  const [lateOrders, setLateOrders] = useState<LateOrder[]>(initial.initialLateOrders)
  const [lowStock, setLowStock] = useState<LowStock[]>(initial.initialLowStock)
  const [loading, startTransition] = useTransition()
  const [error, setError] = useState(initial.initialError)
  useEffect(() => {
    setOrders(initial.initialOrders)
    setLateOrders(initial.initialLateOrders)
    setLowStock(initial.initialLowStock)
    setError(initial.initialError)
  }, [initial.initialOrders, initial.initialLateOrders, initial.initialLowStock, initial.initialError])
  const refresh = () => startTransition(() => router.refresh())
  useEffect(() => {
    const client = createSupabaseBrowserClient()
    if (!client) return
    const channel = client.channel(`admin-overview-live-${crypto.randomUUID()}`)
    for (const table of ['orders', 'order_items', 'inventory', 'admin_order_reminders', 'complaints']) channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => startTransition(() => router.refresh()))
    channel.subscribe()
    return () => { void client.removeChannel(channel) }
  }, [router])
  return { orders, lateOrders, lowStock, loading, error, reload: refresh }
}
