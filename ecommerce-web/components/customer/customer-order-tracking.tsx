'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const steps = ['placed', 'accepted', 'picking', 'packed', 'out_for_delivery', 'delivered']
type Order = { id: number; status: string; total: number; delivery_slot: string | null; address: { label: string; line1: string; city: string; postal_code: string } | null }

export function CustomerOrderTracking() {
  const params = useSearchParams()
  const id = Number(params.get('id'))
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    void (async () => {
      if (!id) { setError('Choose an order to track.'); return }
      const client = createSupabaseBrowserClient()
      if (!client) return
      const { data, error: queryError } = await client.from('orders').select('id,status,total,delivery_slot,address:addresses(label,line1,city,postal_code)').eq('id', id).maybeSingle()
      if (queryError) setError(queryError.message)
      else setOrder(data as Order | null)
      const channel = client.channel(`customer-order-${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => {
        void client.from('orders').select('id,status,total,delivery_slot,address:addresses(label,line1,city,postal_code)').eq('id', id).maybeSingle().then(({ data: next, error: nextError }) => {
          if (nextError) setError(nextError.message)
          else setOrder(next as Order | null)
        })
      }).subscribe()
      unsubscribe = () => { void channel.unsubscribe() }
    })()
    return () => unsubscribe?.()
  }, [id])
  if (error) return <section className="panel placeholder"><h2>{error}</h2><Link className="primary-button" href="/customer/orders">Back to orders</Link></section>
  if (!order) return <section className="panel placeholder"><h2>Loading order…</h2></section>
  const current = steps.indexOf(order.status)
  return <section className="panel"><h2>Order #{order.id}</h2><p>Status: <strong>{order.status.replaceAll('_', ' ')}</strong></p><p>{order.address ? `${order.address.label} · ${order.address.line1}, ${order.address.city} ${order.address.postal_code}` : 'Address unavailable'}</p><p>{order.delivery_slot || 'Delivery slot not selected'}</p><div className="timeline">{steps.map((step, index) => <div className={`timeline-step ${index <= current ? 'done' : ''}`} key={step}><span>{step.replaceAll('_', ' ')}</span></div>)}</div><Link className="secondary-button" href="/customer/orders">Back to orders</Link></section>
}
