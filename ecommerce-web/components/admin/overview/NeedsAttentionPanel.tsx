'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Clock3, PackageCheck, Send, TriangleAlert, X } from 'lucide-react'
import { notifyLateOrder } from '@/app/admin/complaints/actions'
import { ComplaintComposer, type ComplaintOrder } from '@/components/admin/complaints/ComplaintComposer'
import { lateOrderConfig } from '@/lib/late-order-config'
import { formatDeliverySlot } from '@/lib/delivery-slot'
import { useIstNow } from '@/hooks/use-ist-now'
import type { LateOrder, LowStock, Recent } from '@/types/admin-overview'
import { can } from '@/lib/permission-definitions'

function elapsed(milliseconds: number) {
  const minutes = Math.max(0, Math.floor(milliseconds / 60000))
  if (minutes >= 60 * 24) return `${Math.floor(minutes / (60 * 24))} ${Math.floor(minutes / (60 * 24)) === 1 ? 'day' : 'days'}`
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  return `${minutes}m`
}
function ago(value: string) {
  const milliseconds = Math.max(0, Date.now() - Date.parse(value))
  return `${elapsed(milliseconds)} ago`
}

function LateOrderActions({ order, complaintsHref, onReminded, onComplaint, onSuccess }: { order: LateOrder; complaintsHref: string; onReminded: () => void; onComplaint: (order: ComplaintOrder) => void; onSuccess: (message: string) => void }) {
  const [open, setOpen] = useState(false)
  const notifyWrapRef = useRef<HTMLDivElement>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const remaining = order.last_reminded_at ? Math.max(0, 30 * 60 * 1000 - (Date.now() - Date.parse(order.last_reminded_at))) : 0
  const cooling = remaining > 0
  useEffect(() => {
    if (!open) return
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !notifyWrapRef.current?.contains(event.target)) setOpen(false)
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [open])
  async function send() {
    setBusy(true); setMessage('')
    const result = await notifyLateOrder(order.id, note)
    setBusy(false)
    if (!result.ok) { setMessage(result.error); return }
    onSuccess(`Reminder sent for order #${order.id}.`)
    setOpen(false); setNote(''); onReminded()
  }
  const hours = (Date.now() - Date.parse(order.delivery_slot_end ?? order.created_at)) / 3600000
  const severity = hours >= lateOrderConfig.secondSlaHours ? 'late-red' : 'late-amber'
  return <div className="late-order-actions" onClick={event => event.stopPropagation()}>
    {order.last_reminded_at && <small className="late-last-reminded">Last reminded {ago(order.last_reminded_at)}</small>}
    <div className="late-order-action-buttons">
      <div className="late-notify-wrap" ref={notifyWrapRef}><button className="late-notify-button" type="button" disabled={cooling || busy} title={cooling ? `Available in ${elapsed(remaining)}` : 'Notify all store managers'} aria-expanded={open} onClick={() => setOpen(value => !value)}><Send size={12} />Notify</button>
        {open && <div className="late-notify-popover"><label htmlFor={`late-note-${order.id}`}>Optional note <span>{note.length}/200</span></label><textarea id={`late-note-${order.id}`} rows={2} maxLength={200} value={note} onChange={event => setNote(event.target.value)} placeholder="Add a short note for the store team" />{message && <small role="alert">{message}</small>}<button type="button" className="primary-button" disabled={busy} onClick={() => void send()}>{busy ? 'Sending…' : 'Send reminder'}</button></div>}
      </div>
      {order.open_complaint_id ? <Link className="open-complaint-badge" href={`${complaintsHref}?complaint=${order.open_complaint_id}`}>Open complaint</Link> : <button type="button" className="late-complaint-button" onClick={() => onComplaint({ order_id: order.id, customer_name: order.customer, total: order.total, status: order.status })}>Raise complaint</button>}
    </div>
    {message && !open && <small className="late-action-feedback" role="status">{message}</small>}
  </div>
}

export function NeedsAttentionPanel({ loading, error, orders, lateOrders, lowStock, role, ordersHref, inventoryHref, deliveryHref, onReload }: { loading: boolean; error: string; orders: Recent[]; lateOrders: LateOrder[]; lowStock: LowStock[]; role: string | null; ordersHref: string; inventoryHref: string; deliveryHref: string; onReload: () => void }) {
  const now = useIstNow()
  const picker = !can(role, 'reports:view')
  const admin = can(role, 'complaints:raise')
  const waiting = picker ? orders.filter(order => ['placed','accepted','picking'].includes(order.status)).sort((a,b) => (a.delivery_slot_start ? Date.parse(a.delivery_slot_start) : Number.MAX_SAFE_INTEGER)-(b.delivery_slot_start ? Date.parse(b.delivery_slot_start) : Number.MAX_SAFE_INTEGER)).slice(0,5) : lateOrders
  const deliveries = orders.filter(order => order.status === 'out_for_delivery')
  const hasWork = waiting.length > 0 || (!picker && (lowStock.length > 0 || deliveries.length > 0))
  const [complaintOrder, setComplaintOrder] = useState<ComplaintOrder | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [toast,setToast]=useState('')
  const complaintsHref = ordersHref.replace(/\/orders\/?$/, '/complaints')
  const lateOrdersHref = `${ordersHref}?status=unfulfilled`
  return <section className="panel overview-attention-card">
    <header className="panel-heading"><div><p className="eyebrow">LIVE OPERATIONS</p><h2>Needs attention</h2><p>Items that may need action today.</p></div></header>
    {loading ? <div className="overview-attention-skeleton"><i /><i /><i /></div> : error ? <div className="overview-all-caught-up"><strong>Operational data unavailable</strong><small>Use the page alert above to review the error and retry.</small></div> : hasWork ? <div className="overview-attention-content">
      {waiting.length > 0 && <section className="attention-section"><div className="attention-section-heading"><Clock3 size={15} /><h3>{picker ? 'Orders waiting to be picked' : 'Late orders'}</h3><Link href={picker ? ordersHref.replace('/orders','/picker') : lateOrdersHref}>View all late orders <ArrowRight size={13} /></Link></div><div className="attention-list">{waiting.map(order => {
        const age = Math.max(0, Date.now() - Date.parse(order.created_at))
        const slot = formatDeliverySlot(order, now)
        const overdueClass = age >= lateOrderConfig.secondSlaHours * 3600000 ? 'late-red' : 'late-amber'
        const href = picker ? ordersHref.replace('/orders','/picker') : `${ordersHref}?search=${order.id}`
        return <div className={`attention-order late-order ${overdueClass}`} key={order.id}>
          <Link className="late-order-main" href={href}><span><strong>Order #{order.id}</strong><small>{order.customer}</small>{slot.display&&<small>{slot.display}</small>}</span><span className="attention-wait">{slot.late ? `Late by ${elapsed(Date.now()-Date.parse(order.delivery_slot_end ?? order.created_at))}` : `waiting ${elapsed(age)}`}</span><span className={`order-status-pill order-status-${order.status.replaceAll('_','-')}`}><i />{order.status.replaceAll('_',' ')}</span></Link>
          {admin && 'last_reminded_at' in order && <LateOrderActions order={order as LateOrder} complaintsHref={complaintsHref} onReminded={onReload} onComplaint={value => { setComplaintOrder(value); setComposerOpen(true) }} onSuccess={message=>{setToast(message);window.setTimeout(()=>setToast(''),4500)}} />}
        </div>
      })}</div></section>}
      {!picker && <div className="attention-secondary-grid">
        {lowStock.length > 0 && <section className="attention-section"><div className="attention-section-heading"><TriangleAlert size={15} /><h3>Low and out of stock</h3><Link href={inventoryHref}>Restock <ArrowRight size={13} /></Link></div><div className="attention-list">{lowStock.slice(0,5).map(item => { const available = Math.max(0,item.current_stock-(item.reserved_stock??0)); const isOut=available<=0; return <div className="attention-stock" key={item.product_id}><span className={`attention-stock-icon ${isOut?'out':'low'}`}><TriangleAlert size={14}/></span><span><strong>{item.product_name}</strong><small>Available {available} · reorder at {item.reorder_level}</small></span><b className={isOut?'out':'low'}>{isOut?'Out':'Low'}</b></div> })}</div></section>}
        <section className="attention-section attention-deliveries"><div className="attention-section-heading"><PackageCheck size={15}/><h3>Deliveries in progress</h3><Link href={deliveryHref}>Delivery <ArrowRight size={13}/></Link></div><div className="attention-delivery-summary"><strong>{deliveries.length}</strong><span>{deliveries.length===1?'order is':'orders are'} out for delivery</span></div></section>
      </div>}
    </div> : <div className="overview-all-caught-up"><span>✓</span><strong>All caught up</strong><small>Nothing needs your attention right now.</small></div>}
    {composerOpen && <ComplaintComposer order={complaintOrder} onClose={() => setComposerOpen(false)} onCreated={() => onReload()} />}
    {toast&&<div className="admin-action-toast" role="status"><CheckCircle2 size={17}/><span>{toast}</span><button aria-label="Dismiss" onClick={()=>setToast('')}><X size={15}/></button></div>}
  </section>
}
