'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock3, MapPin, Package, QrCode, RefreshCw, Truck } from 'lucide-react'
import { AdminShell } from '@/components/admin/admin-shell'
import { useRealtimeReload } from '@/lib/use-realtime-reload'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/formatters'

type Relation<T> = T | T[] | null
export type Pickup = { id: number; order_id: number; type: string; amount: number; pickup_slot: string | null; pickup_code: string | null; status: string; refund_items: { quantity: number; order_items: Relation<{ products: Relation<{ name: string }> }> }[] | null; orders: Relation<{ total: number; addresses: Relation<{ label: string | null; line1: string; city: string; postal_code: string }> }> }
const one = <T,>(value: Relation<T>): T | null => Array.isArray(value) ? value[0] ?? null : value
function pickupErrorMessage(message: string) {
  if (message.includes('INVALID_PICKUP_CODE')) return 'That pickup code does not match this request.'
  if (message.includes('INVALID_REFUND_STEP')) return 'This pickup has already changed status. Refresh the queue and try again.'
  if (message.includes('FORBIDDEN') || message.includes('42501')) return 'This account needs delivery pickup or refund receiving permission to scan this request.'
  if (message.includes('delivery_scan_return_pickup') || message.includes('PGRST202') || message.includes('42883')) return 'The pickup workflow database update is missing. Run supabase/migrations/phases/phase45_return_pickup_dispatch.sql, then refresh.'
  return `Couldn’t record this scan: ${message}`
}

export function ReturnPickupQueue({ initialRows, initialError }: { initialRows: Pickup[]; initialError: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [rows, setRows] = useState(initialRows)
  const [loadError, setLoadError] = useState(initialError)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [codes, setCodes] = useState<Record<number, string>>({})
  useEffect(() => { setRows(initialRows); setLoadError(initialError); setActionError('') }, [initialRows, initialError])
  const refresh = () => startTransition(() => router.refresh())
  useRealtimeReload('delivery-return-pickups', ['refunds', 'refund_items'], refresh)
  async function markPickedUp(row: Pickup, code: string) {
    const client = createSupabaseBrowserClient()
    if (!client || busy !== null) return
    setBusy(row.id); setActionError('')
    const { data: nextStatus, error: rpcError } = await client.rpc('delivery_scan_return_pickup', { p_refund_id: row.id, p_pickup_code: code })
    if (rpcError) {
      console.error('[delivery-returns] Pickup step failed:', rpcError.message)
      setActionError(pickupErrorMessage(rpcError.message))
    } else {
      if (nextStatus === 'delivered') setRows(current => current.filter(item => item.id !== row.id))
      else setRows(current => current.map(item => item.id === row.id ? { ...item, status: String(nextStatus ?? 'picked_up') } : item))
      refresh()
    }
    setBusy(null)
  }
  return <section className="return-pickup-section" aria-labelledby="return-pickup-title"><header><div><p className="eyebrow">RETURNS</p><h2 id="return-pickup-title">Return and exchange pickups</h2><p>Confirm scheduled collections with the customer’s four-digit pickup code.</p></div><button className="secondary-button" onClick={refresh}><RefreshCw size={15} />Refresh</button></header>
    {loadError ? <div className="panel return-pickup-state" role="alert"><strong>We couldn’t load return pickups</strong><p>{loadError}</p><button className="secondary-button" onClick={refresh}>Retry</button></div> : <>{actionError && <div className="panel return-pickup-action-error" role="alert"><strong>We couldn’t record this scan</strong><p>{actionError}</p></div>}{rows.length ? <div className="return-pickup-grid">{rows.map(row => { const order = one(row.orders); const address = one(order?.addresses); const code = codes[row.id] ?? ''; const collected = row.status === 'picked_up'; return <article className="panel return-pickup-card" key={row.id}><div className="return-pickup-card-top"><div><strong>{row.type === 'exchange' ? 'Exchange' : 'Return'} RF-{row.id} · Order #{row.order_id}</strong><span className={`refund-status-pill ${collected ? 'out_for_delivery' : 'pickup_scheduled'}`}>{collected ? 'Successfully picked up' : 'Pickup scheduled'}</span></div><strong>{row.type === 'exchange' ? 'No refund' : money(Number(row.amount))}</strong></div><p><Clock3 size={14} />{row.pickup_slot ?? 'Pickup expected today or tomorrow'}</p><p><MapPin size={14} />{[address?.label,address?.line1,address?.city,address?.postal_code].filter(Boolean).join(', ') || 'Pickup address unavailable'}</p><div className="return-pickup-items">{(row.refund_items ?? []).map((item,index)=><span key={`${row.id}-${index}`}><Package size={13}/>{one(one(item.order_items)?.products)?.name ?? 'Ordered item'} × {item.quantity}</span>)}</div><label>Pickup code<input inputMode="numeric" pattern="[0-9]*" maxLength={4} value={code} onChange={event => setCodes(value => ({ ...value, [row.id]: event.target.value.replace(/\D/g,'').slice(0,4) }))} aria-label={`Pickup code for return request ${row.id}`} /></label><div className="return-pickup-actions"><button type="button" className="secondary-button" onClick={() => setCodes(value => ({ ...value, [row.id]: row.pickup_code ?? '' }))}><QrCode size={15} />Mock Scan QR</button><button type="button" className="primary-button" disabled={busy === row.id || code.length !== 4} onClick={() => void markPickedUp(row, code)}>{busy === row.id ? 'Saving…' : collected ? 'Scan delivered' : 'Scan pickup'}</button></div></article> })}</div> : <div className="panel return-pickup-state"><Truck size={22}/><strong>No return pickups scheduled</strong><p>Scheduled return collections will appear here.</p></div>}</>}
  </section>
}
