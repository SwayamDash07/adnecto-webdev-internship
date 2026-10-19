'use client'

import { useCallback, useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { LateOrder, LowStock, Recent } from '@/types/admin-overview'
import { can } from '@/lib/permission-definitions'

export function useAdminOverview(role: string | null = null, initial: { initialOrders: Recent[]; initialLateOrders: LateOrder[]; initialLowStock: LowStock[]; initialError: string }) {
  const [orders, setOrders] = useState<Recent[]>(initial.initialOrders)
  const [lateOrders, setLateOrders] = useState<LateOrder[]>(initial.initialLateOrders)
  const [lowStock, setLowStock] = useState<LowStock[]>(initial.initialLowStock)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initial.initialError)
  const load = useCallback(async () => {
    const client = createSupabaseBrowserClient()
    if (!client) { setError('Supabase browser configuration is missing.'); setLoading(false); return }
    setError(''); setLoading(true)
    const orderResult = await client.rpc('admin_list_orders')
    if (orderResult.error) { setError(orderResult.error.message); setOrders([]); setLowStock([]); setLoading(false); return }
    setOrders((orderResult.data ?? []).map((row: { order_id: number; customer_name: string; total: number; status: string; created_at: string; delivery_slot_start:string|null; delivery_slot_end:string|null }) => ({ id: row.order_id, customer: row.customer_name, total: row.total, status: row.status, created_at: row.created_at, delivery_slot_start:row.delivery_slot_start, delivery_slot_end:row.delivery_slot_end })) as Recent[])
    if (!can(role, 'reports:view')) { setLowStock([]); setLateOrders([]); setLoading(false); return }
    const [stock, late] = await Promise.all([
      client.from('dashboard_low_stock').select('*').limit(8),
      client.rpc('admin_list_late_orders'),
    ])
    if (stock.error) setError(stock.error.message)
    if (late.error) setError(late.error.message)
    setLowStock((stock.data ?? []) as LowStock[])
    setLateOrders((late.data ?? []).map((row: { order_id: number; customer_name: string; total: number; status: string; created_at: string; delivery_slot_start:string|null; delivery_slot_end:string|null; last_reminded_at: string | null; open_complaint_id: number | null }) => ({ id: row.order_id, customer: row.customer_name, total: row.total, status: row.status, created_at: row.created_at, delivery_slot_start:row.delivery_slot_start, delivery_slot_end:row.delivery_slot_end, last_reminded_at: row.last_reminded_at, open_complaint_id: row.open_complaint_id })) as LateOrder[])
    setLoading(false)
  }, [role])
  useEffect(() => { const client = createSupabaseBrowserClient(); if (!client) return; const channel = client.channel(`admin-overview-live-${crypto.randomUUID()}`); for (const table of ['orders', 'order_items', 'inventory', 'admin_order_reminders', 'complaints']) channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => { void load() }); channel.subscribe(); return () => { void client.removeChannel(channel) } }, [load])
  return { orders, lateOrders, lowStock, loading, error, reload: load }
}
