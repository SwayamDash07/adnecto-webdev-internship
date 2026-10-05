'use client'

import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { orderPageSize } from '@/constants/admin-orders'
import type { AdminOrder, AdminOrderSort } from '@/types/admin-orders'

export function useAdminOrderQueue() {
  const [orders, setOrders] = useState<AdminOrder[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState<number | null>(null)
  const [query, setQuery] = useState(''); const [status, setStatus] = useState(''); const [sort, setSort] = useState<AdminOrderSort>('newest'); const [page, setPage] = useState(1)
  async function load() { setLoading(true); setError(''); const client = createSupabaseBrowserClient(); if (!client) { setError('Supabase browser configuration is missing.'); setLoading(false); return }; const { data, error: queryError } = await client.rpc('admin_list_orders'); if (queryError) setError(`Could not load orders: ${queryError.message}`); else setOrders((data ?? []) as AdminOrder[]); setLoading(false) }
  useEffect(() => { const client = createSupabaseBrowserClient(); if (!client) return; const channel = client.channel('admin-orders-live').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { void load() }).subscribe(); void load(); return () => { void channel.unsubscribe() } }, [])
  async function updateStatus(orderId: number, nextStatus: string) { setBusy(orderId); setError(''); const client = createSupabaseBrowserClient(); if (!client) { setError('Supabase browser configuration is missing.'); setBusy(null); return }; const { error: updateError } = await client.rpc('admin_update_order_status', { p_order_id: orderId, p_status: nextStatus }); if (updateError) setError(`Could not update order: ${updateError.message}`); else await load(); setBusy(null) }
  const visibleOrders = useMemo(() => { const filtered = orders.filter(order => (!query || `${order.order_id} ${order.customer_name} ${order.customer_email}`.toLowerCase().includes(query.toLowerCase())) && (!status || order.status === status)); return filtered.sort((a, b) => sort === 'highest' ? Number(b.total) - Number(a.total) : sort === 'oldest' ? Date.parse(a.created_at) - Date.parse(b.created_at) : Date.parse(b.created_at) - Date.parse(a.created_at)) }, [orders, query, status, sort])
  const totalPages = Math.max(1, Math.ceil(visibleOrders.length / orderPageSize)); const pageRows = visibleOrders.slice((page - 1) * orderPageSize, page * orderPageSize)
  useEffect(() => { setPage(1) }, [query, status, sort])
  return { orders, error, loading, busy, query, setQuery, status, setStatus, sort, setSort, page, setPage, visibleOrders, totalPages, pageRows, load, updateStatus }
}
