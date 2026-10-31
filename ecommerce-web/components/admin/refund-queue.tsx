'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, RefreshCw, X, Check, Clock3, Package, UserRound } from 'lucide-react'
import { AdminShell } from '@/components/admin/admin-shell'
import { money } from '@/lib/formatters'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRealtimeReload } from '@/lib/use-realtime-reload'
import { REQUEST_SLA_HOURS } from '@/lib/returns-config'

type Relation<T> = T | T[] | null
type RefundItem = { quantity: number; amount: number; order_items: Relation<{ unit_price: number; products: Relation<{ name: string; product_images: { storage_path: string; sort_order: number | null }[] | null }> }> }
type Event = { from_status: string | null; to_status: string; actor_id: string | null; actor_role: string | null; note: string | null; created_at: string }
export type Refund = {
  id: number; order_id: number; requested_by: string; status: string; type: string; reason: string; comment: string | null; decision_note: string | null; amount: number; final_amount: number | null; final_amount_reason: string | null; fee_amount: number; auto_approved: boolean; pickup_slot: string | null; pickup_code: string | null; qr_payload: string | null; pickup_reschedules: number; pickup_address_id: number | null; item_condition: string | null; condition_note: string | null; return_to_stock: boolean | null; refund_reference: string | null; created_at: string; updated_at: string; decided_at: string | null; refunded_at: string | null; expected_arrival_at: string | null; refund_items: RefundItem[] | null; refund_events: Event[] | null; orders: Relation<{ total: number; user_id: string; payments: Relation<{ method: string; status: string; amount: number }>; addresses: Relation<{ label: string | null; line1: string; city: string; postal_code: string }> }>
}
type Permissions = { canDecide: boolean; canReceive: boolean; canPay: boolean }
type Filter = 'all' | 'requested' | 'pickup' | 'to_refund' | 'refunded' | 'exchange'
const statusText = (status: string) => status === 'picked_up' ? 'Successfully picked up' : status.replaceAll('_', ' ')
const one = <T,>(value: Relation<T>): T | null => Array.isArray(value) ? value[0] ?? null : value
const istDate = (value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => new Date(value).toLocaleString('en-IN', { ...options, timeZone: 'Asia/Kolkata' })
function friendlyRefundError(message: string) {
  if (message.includes('FORBIDDEN')) return 'Your role cannot perform this step.'
  if (message.includes('INVALID_REFUND_STEP')) return 'This request changed. Refresh the queue and review its current step.'
  if (message.includes('REJECTION_NOTE_REQUIRED')) return 'Add a note before rejecting this request.'
  if (message.includes('INVALID_PICKUP_SLOT')) return 'Choose one of the available pickup windows.'
  if (message.includes('INVALID_PICKUP_CODE')) return 'That pickup code does not match this request.'
  if (message.includes('RECEIPT_DETAILS_REQUIRED')) return 'Choose an item condition and add a note.'
  if (message.includes('STOCK_RETURN_REQUIRES_GOOD_CONDITION')) return 'Only items in good condition can be returned to stock.'
  if (message.includes('FINAL_AMOUNT_REASON_REQUIRED')) return 'Add a reason when lowering the refund amount.'
  if (message.includes('REFUND_EXCEEDS_AMOUNT_PAID')) return 'This refund would exceed the amount paid.'
  if (message.includes('RAZORPAY_TEST_MODE_REQUIRED')) return 'Refund processing is restricted to Razorpay Test Mode. Configure an rzp_test_ key.'
  if (message.includes('PAYMENT_PROVIDER_NOT_CONFIGURED')) return 'Razorpay test credentials are not configured on the server.'
  if (message.includes('SUPABASE_SERVICE_ROLE_NOT_CONFIGURED')) return 'The server is missing its Supabase service role key, so a refund cannot be safely recorded.'
  if (message.includes('RAZORPAY_CAPTURED_PAYMENT_REQUIRED')) return 'This order has no captured Razorpay payment to refund.'
  if (message.includes('INVALID_REFUND_AMOUNT')) return 'Enter a valid refund amount within the allowed limit.'
  if (message.includes('PARTIAL_REFUND_REASON_REQUIRED')) return 'Add a reason for a partial refund.'
  if (message.includes('RAZORPAY_REFUND_CONNECTION_FAILED')) return 'Razorpay did not respond. Retry the same amount to safely continue.'
  if (message.includes('RAZORPAY_REFUNDED_LOCAL_UPDATE_FAILED')) return 'Razorpay accepted the refund, but Cartly could not update the request. Retry the same amount.'
  if (message.includes('RAZORPAY_REFUND_LOOKUP_FAILED')) return 'Razorpay accepted a previous refund, but its status could not be checked. Retry the same amount.'
  if (message.includes('REFUND_ALREADY_ISSUED_DIFFERENT_AMOUNT')) return 'Razorpay already has a refund for this request at a different amount. Refresh the request to reconcile it.'
  if (message.includes('RAZORPAY_REFUND_FAILED')) return message
  return 'We couldn’t update this request. Please retry.'
}

export function RefundQueue({ initialRows, initialCustomerNames, initialError, permissions }: { initialRows: Refund[]; initialCustomerNames: Record<string, string>; initialError: string; permissions: Permissions }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [rows, setRows] = useState(initialRows)
  const [customerNames] = useState(initialCustomerNames)
  const [error, setError] = useState(initialError)
  const [actionError, setActionError] = useState('')
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [type, setType] = useState<'all' | 'return_and_refund' | 'refund_only' | 'exchange'>('all')
  const [autoOnly, setAutoOnly] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [active, setActive] = useState<Refund | null>(null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const portalOrders = `/portal/${process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN ?? ''}/orders`

  useEffect(() => { setRows(initialRows); setError(initialError); setLoading(false) }, [initialRows, initialError])
  function refresh() { setLoading(true); startTransition(() => router.refresh()) }
  useRealtimeReload('admin-refund-queue', ['refunds', 'refund_items', 'refund_events'], refresh)

  const counts = useMemo(() => ({ all: rows.length, requested: rows.filter(row => row.status === 'requested').length, pickup: rows.filter(row => ['approved', 'pickup_scheduled', 'picked_up', 'delivered'].includes(row.status) && row.type !== 'refund_only').length, to_refund: rows.filter(row => row.type !== 'exchange' && ['received', 'approved'].includes(row.status)).length, refunded: rows.filter(row => row.status === 'refunded').length, exchange: rows.filter(row => row.type === 'exchange').length }), [rows])
  const filtered = useMemo(() => rows.filter(row => {
    const customer = customerNames[row.requested_by] ?? 'Customer'
    const matchesSearch = `RF-${row.id} ${row.order_id} ${customer}`.toLowerCase().includes(query.trim().toLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'exchange' ? row.type === 'exchange' : filter === 'requested' ? row.status === 'requested' : filter === 'pickup' ? ['approved', 'pickup_scheduled', 'picked_up', 'delivered'].includes(row.status) && row.type !== 'refund_only' : filter === 'to_refund' ? ['received', 'approved'].includes(row.status) && row.type !== 'exchange' : row.status === 'refunded')
    return matchesSearch && matchesFilter && (type === 'all' || row.type === type) && (!autoOnly || row.auto_approved)
  }).sort((a, b) => a.created_at.localeCompare(b.created_at)), [rows, customerNames, query, filter, type, autoOnly])
  const now = Date.now()
  const thisWeek = rows.filter(row => row.status === 'refunded' && now - Date.parse(row.refunded_at ?? row.updated_at) <= 7 * 86400000).reduce((sum, row) => sum + Number(row.final_amount ?? row.amount), 0)
  const thisMonth = rows.filter(row => { const date = new Date(row.refunded_at ?? row.updated_at); const today = new Date(); return row.status === 'refunded' && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear() }).reduce((sum, row) => sum + Number(row.final_amount ?? row.amount), 0)

  async function changeStatus(row: Refund, status: string, note?: string, extra: Record<string, unknown> = {}) {
    const client = createSupabaseBrowserClient()
    if (!client || busy) return false
    setBusy(true); setActionError('')
    if (status === 'refunded') {
      const amount = Number(extra.p_final_amount ?? row.final_amount ?? row.amount)
      const reason = typeof extra.p_final_amount_reason === 'string' ? extra.p_final_amount_reason : row.final_amount_reason
      try {
        const response = await fetch(`/api/admin/refunds/${row.id}/process`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, reason }) })
        const result = await response.json() as { error?: string; refundId?: string; amount?: number }
        if (!response.ok) {
          setActionError(friendlyRefundError(result.error ?? ''))
          setBusy(false)
          return false
        }
        setToast(`Razorpay test refund ${result.refundId ?? ''} created for ${money(Number(result.amount ?? amount))}.`)
        setActive(null)
        setBusy(false)
        refresh()
        return true
      } catch {
        setActionError('Razorpay did not respond. Retry the same amount to safely continue.')
        setBusy(false)
        return false
      }
    }
    const approveAndSchedule = (status === 'approved' || (status === 'pickup_scheduled' && row.status === 'approved')) && row.type !== 'refund_only'
    const recordReceipt = status === 'received' && row.status === 'delivered'
    const rpcName = approveAndSchedule ? 'approve_and_schedule_return_pickup' : recordReceipt ? 'receive_delivered_return' : row.type === 'exchange' ? 'set_exchange_status' : 'set_refund_status'
    const rpcArgs = approveAndSchedule || recordReceipt
      ? { p_refund_id: row.id, ...(recordReceipt ? { p_condition: extra.p_condition, p_condition_note: extra.p_condition_note, p_return_to_stock: extra.p_return_to_stock, p_final_amount: extra.p_final_amount, p_final_amount_reason: extra.p_final_amount_reason } : {}) }
      : { p_refund_id: row.id, p_status: status, p_note: note ?? null, ...extra }
    const { error: rpcError } = await client.rpc(rpcName, rpcArgs)
    if (rpcError) {
      console.error('[refunds] Status update failed:', rpcError.message)
      setActionError(friendlyRefundError(rpcError.message))
      setBusy(false)
      return false
    }
    setToast(approveAndSchedule ? `Request RF-${row.id} approved. Pickup is expected today or tomorrow.` : `Request RF-${row.id} moved to ${statusText(status)}.`)
    setActive(null)
    setBusy(false)
    refresh()
    return true
  }

  async function bulkApprove() {
    const eligible = rows.filter(row => selected.includes(row.id) && row.status === 'requested')
    const skipped = selected.length - eligible.length
    let approved = 0
    for (const row of eligible) if (await changeStatus(row, 'approved')) approved++
    setSelected([])
    setToast(`${approved} approved${skipped ? ` · ${skipped} skipped because their status changed` : ''}.`)
    refresh()
  }

  const stats: Array<[Filter, string, string]> = [['requested', 'Needs review', String(counts.requested)], ['pickup', 'In pickup', String(counts.pickup)], ['to_refund', 'To refund', String(counts.to_refund)], ['refunded', 'Refunded this week', money(thisWeek)], ['refunded', 'Refunded this month', money(thisMonth)]]
  return <AdminShell title="Returns & refunds" description="Review each request and move it through one controlled step at a time.">
    <section className="refund-admin-stats" aria-label="Refund queue summary">{stats.map(([key, label, value], index) => <button key={`${label}-${index}`} className={filter === key && index < 3 ? 'active' : ''} onClick={() => setFilter(key)}><span>{label}</span><strong>{value}</strong></button>)}</section>
    <section className="refund-admin-toolbar panel"><label className="refund-admin-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search request, order or customer" aria-label="Search refunds" /></label><div className="refund-admin-filters" role="group" aria-label="Refund status filters">{(['all', 'requested', 'pickup', 'to_refund', 'refunded', 'exchange'] as Filter[]).map(value => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : value === 'to_refund' ? 'To refund' : value === 'pickup' ? 'In pickup' : value === 'exchange' ? 'Exchange' : statusText(value)}<span>{counts[value]}</span></button>)}</div><label className="refund-admin-select">Type<select value={type} onChange={event => setType(event.target.value as typeof type)}><option value="all">All types</option><option value="return_and_refund">Return and refund</option><option value="exchange">Exchange</option><option value="refund_only">Legacy refund only</option></select></label><label className="refund-admin-auto"><input type="checkbox" checked={autoOnly} onChange={event => setAutoOnly(event.target.checked)} />Auto-approved</label>{permissions.canDecide && selected.length > 0 && <button className="primary-button" disabled={busy} onClick={() => void bulkApprove()}>Approve selected ({selected.length})</button>}</section>
    {error ? <section className="panel refund-admin-state" role="alert"><strong>We couldn’t load refund requests</strong><p>{error}</p><button className="secondary-button" onClick={refresh}>Retry</button></section> : loading ? <section className="panel refund-admin-skeleton" aria-busy="true">{Array.from({ length: 5 }, (_, i) => <i key={i} />)}</section> : filtered.length ? <section className="panel refund-admin-table-panel"><div className="refund-admin-table-scroll"><table className="refund-admin-table"><thead><tr><th><span className="sr-only">Select</span></th><th>Request</th><th>Customer</th><th>Order</th><th>Reason</th><th>Type</th><th>Amount</th><th>Status</th><th>Age / SLA</th></tr></thead><tbody>{filtered.map(row => { const ageHours = Math.max(0, (now - Date.parse(row.created_at)) / 3600000); const overdue = row.status === 'requested' && ageHours > REQUEST_SLA_HOURS; return <tr key={row.id} onClick={() => setActive(row)} tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') setActive(row) }}><td onClick={event => event.stopPropagation()}>{row.status === 'requested' && permissions.canDecide && <input type="checkbox" aria-label={`Select request RF-${row.id}`} checked={selected.includes(row.id)} onChange={event => setSelected(value => event.target.checked ? [...value, row.id] : value.filter(id => id !== row.id))} />}</td><td><strong>RF-{row.id}</strong>{row.auto_approved && <small className="refund-admin-auto-badge">Auto-approved</small>}</td><td>{customerNames[row.requested_by] ?? 'Customer'}</td><td>#{row.order_id}</td><td>{row.reason}</td><td>{row.type === 'exchange' ? 'Exchange' : row.type === 'return_and_refund' ? 'Return + refund' : 'Legacy refund only'}</td><td>{row.type === 'exchange' ? 'No refund' : money(Number(row.final_amount ?? row.amount))}</td><td><span className={`refund-status-pill ${row.status}`}>{statusText(row.status)}</span></td><td>{overdue ? <span className="refund-sla overdue"><Clock3 size={13} />Waiting over 24h</span> : `${Math.floor(ageHours)}h`}</td></tr> })}</tbody></table></div><div className="refund-admin-cards">{filtered.map(row => <button className="refund-admin-card" key={row.id} onClick={() => setActive(row)}><span><strong>RF-{row.id}</strong><span className={`refund-status-pill ${row.status}`}>{statusText(row.status)}</span></span><span>Order #{row.order_id} · {customerNames[row.requested_by] ?? 'Customer'}</span><strong>{row.type === 'exchange' ? 'No refund' : money(Number(row.final_amount ?? row.amount))}</strong></button>)}</div></section> : <section className="panel refund-admin-state"><Package size={22} /><strong>{rows.length ? 'No requests match these filters' : 'No return or refund requests'}</strong><p>{rows.length ? 'Try another status, reason, or customer.' : 'New customer requests will appear here.'}</p></section>}
    {toast && <div className="refund-toast" role="status" aria-live="polite">{toast}<button aria-label="Dismiss message" onClick={() => setToast('')}><X size={14} /></button></div>}
    {active && <RefundDrawer row={active} customerName={customerNames[active.requested_by] ?? 'Customer'} permissions={permissions} busy={busy} error={actionError} onClose={() => { setActive(null); setActionError('') }} onStep={(status, note, extra) => void changeStatus(active, status, note, extra)} portalOrders={portalOrders} />}
  </AdminShell>
}

function RefundDrawer({ row, customerName, permissions, busy, error, onClose, onStep, portalOrders }: { row: Refund; customerName: string; permissions: Permissions; busy: boolean; error: string; onClose: () => void; onStep: (status: string, note?: string, extra?: Record<string, unknown>) => void; portalOrders: string }) {
  const [note, setNote] = useState('')
  const [returnToStock, setReturnToStock] = useState(true)
  const refundLimit = Number(row.final_amount ?? row.amount)
  const [refundAmount, setRefundAmount] = useState(String(refundLimit))
  const [refundReason, setRefundReason] = useState(row.final_amount_reason ?? '')
  const isPartialRefund = Number(refundAmount) < refundLimit
  const refundAmountValid = Number.isFinite(Number(refundAmount)) && Number(refundAmount) > 0 && Number(refundAmount) <= refundLimit && (!isPartialRefund || Boolean(refundReason.trim()))
  useEffect(() => {
    setNote('')
    setReturnToStock(true)
    setRefundAmount(String(Number(row.final_amount ?? row.amount)))
    setRefundReason(row.final_amount_reason ?? '')
  }, [row.id, row.amount, row.final_amount, row.final_amount_reason])
  const orders = one(row.orders)
  const address = one(orders?.addresses)
  const payment = one(orders?.payments)
  return <div className="refund-drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><aside className="refund-admin-drawer" role="dialog" aria-modal="true" aria-labelledby="refund-drawer-title"><header><div><small>{row.type === 'exchange' ? 'EXCHANGE REQUEST' : 'RETURN REQUEST'} · RF-{row.id}</small><h2 id="refund-drawer-title">Order #{row.order_id}</h2><span className={`refund-status-pill ${row.status}`}>{statusText(row.status)}</span></div><button className="refund-drawer-close" aria-label="Close request details" onClick={onClose}><X size={18} /></button></header><div className="refund-admin-drawer-body">{error && <p className="refund-error" role="alert">{error}</p>}<section><h3><UserRound size={15} />Customer</h3><strong>{customerName}</strong><small>Request submitted {istDate(row.created_at, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></section><section><h3>Reason and comment</h3><p><strong>{row.reason}</strong></p><p>{row.comment || 'No additional comment.'}</p>{row.auto_approved && <span className="refund-admin-auto-badge">Auto-approved</span>}</section><section><h3><Package size={15} />Items</h3>{(row.refund_items ?? []).map((item, index) => { const orderItem = one(item.order_items); const product = one(orderItem?.products); const image = [...(product?.product_images ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.storage_path; return <div className="refund-admin-item" key={`${row.id}-${index}`}>{image ? <img src={image} alt="" /> : <span><Package size={16} /></span>}<div><strong>{product?.name ?? 'Ordered item'} × {item.quantity}</strong>{row.type !== 'exchange' && <small>Saved line amount {money(Number(item.amount))}</small>}</div></div> })}{row.type === 'exchange' ? <p className="refund-demo-note">Exchange · no refund</p> : <dl><div><dt>Items and saved tax / discount</dt><dd>{money(Number(row.amount) - Number(row.fee_amount))}</dd></div><div><dt>Fees</dt><dd>{money(Number(row.fee_amount))}</dd></div><div><dt>Final refund</dt><dd>{money(Number(row.final_amount ?? row.amount))}</dd></div></dl>}</section><section><h3>Order and payment</h3><p>Order total: {money(Number(orders?.total ?? 0))}</p><p>{payment ? `${payment.method} · ${payment.status} · ${money(Number(payment.amount))}` : 'Payment details unavailable'}</p><Link href={`${portalOrders}?order=${row.order_id}`}>Open order #{row.order_id}</Link></section>{address && <section><h3>Pickup address</h3><p>{[address.label,address.line1,address.city,address.postal_code].filter(Boolean).join(', ')}</p>{row.pickup_slot && <p>Pickup window: {row.pickup_slot}</p>}{row.pickup_code && <p>Pickup code: <strong>{row.pickup_code}</strong></p>}</section>}<section><h3>Request timeline</h3><ol className="refund-admin-events">{(row.refund_events ?? []).map((event, index) => <li key={`${event.created_at}-${index}`}><strong>{event.from_status ? `${statusText(event.from_status)} → ` : ''}{statusText(event.to_status)}</strong><small>{istDate(event.created_at, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })} · {event.actor_role ?? 'system'}</small>{event.note && <p>{event.note}</p>}</li>)}</ol></section>
      <section className="refund-current-action"><h3>Current step</h3>
        {row.status === 'requested' && <>{permissions.canDecide ? <><button className="primary-button" disabled={busy} onClick={() => onStep('approved')}>Approve request</button><label>Reject note<textarea value={note} maxLength={500} onChange={event => setNote(event.target.value)} placeholder="Required reason for rejection" /></label><button className="refund-danger-button" disabled={busy || !note.trim()} onClick={() => { if (window.confirm('Reject this request?')) onStep('rejected', note.trim()) }}>Reject request</button></> : <p title="Requires refunds:decide">Your role can view this request but cannot decide it.</p>}</>}
        {row.status === 'approved' && row.type !== 'refund_only' && <>{permissions.canDecide ? <><p>Pickup will be arranged for today or tomorrow.</p><button className="primary-button" disabled={busy} onClick={() => onStep('pickup_scheduled')}>Schedule pickup</button></> : <p title="Requires refunds:decide">Your role cannot schedule pickup.</p>}</>}
        {row.status === 'pickup_scheduled' && <>{permissions.canReceive ? <><label>Pickup code (optional)<input inputMode="numeric" maxLength={4} value={note} onChange={event => setNote(event.target.value)} placeholder="Enter the 4-digit code" /></label><button className="primary-button" disabled={busy} onClick={() => onStep('picked_up', undefined, { p_pickup_code: note || null })}>Mark picked up</button></> : <p title="Requires delivery pickup or refunds:receive">Pickup is waiting for the delivery partner.</p>}</>}
        {row.status === 'approved' && row.type === 'refund_only' && <>{permissions.canPay ? <><p className="refund-demo-note">Razorpay Test Mode · no live money is moved.</p><label>Refund amount (up to {money(refundLimit)})<input type="number" min="0.01" max={refundLimit} step="0.01" value={refundAmount} onChange={event => setRefundAmount(event.target.value)} /></label>{isPartialRefund && <label>Reason for partial refund<textarea value={refundReason} maxLength={500} onChange={event => setRefundReason(event.target.value)} /></label>}<button className="primary-button" disabled={busy || !refundAmountValid} onClick={() => { if (window.confirm(`Issue a Razorpay test refund of ${money(Number(refundAmount))}?`)) onStep('refunded', undefined, { p_final_amount: Number(refundAmount), p_final_amount_reason: isPartialRefund ? refundReason.trim() : null }) }}>Refund {money(Number(refundAmount) || 0)}</button></> : <p title="Requires refunds:pay">Your role cannot issue a refund.</p>}</>}
        {row.status === 'delivered' && row.type === 'exchange' && <>{permissions.canReceive ? <><label>Stock choice<select value={returnToStock ? 'return' : 'write_off'} onChange={event => setReturnToStock(event.target.value === 'return')}><option value='return'>Return to stock</option><option value='write_off'>Write off</option></select></label><button className='primary-button' disabled={busy} onClick={() => onStep('received', undefined, { p_condition: 'Good', p_condition_note: 'Accepted by delivery partner', p_return_to_stock: returnToStock })}>Confirm returned item received</button></> : <p title='Requires refunds:receive'>Your role cannot receive this exchange return.</p>}</>}
        {row.status === 'delivered' && row.type !== 'exchange' && <>{permissions.canReceive ? <><label>Stock choice<select value={returnToStock ? 'return' : 'write_off'} onChange={event => setReturnToStock(event.target.value === 'return')}><option value='return'>Return to stock</option><option value='write_off'>Write off</option></select></label><button className='primary-button' disabled={busy} onClick={() => onStep('received', undefined, { p_condition: 'Good', p_condition_note: 'Accepted by delivery partner', p_final_amount: null, p_final_amount_reason: null, p_return_to_stock: returnToStock })}>Confirm received</button></> : <p title='Requires refunds:receive'>Your role cannot receive this return.</p>}</>}
        {row.status === 'received' && row.type === 'exchange' && <>{permissions.canReceive ? <><p className="refund-demo-note">No refund will be issued. A fresh piece will be delivered to the original address.</p><button className="primary-button" disabled={busy} onClick={() => { if (window.confirm('Dispatch a fresh replacement? Stock will be deducted.')) onStep('exchange_dispatched') }}>Dispatch replacement</button></> : <p title="Requires refunds:receive">Your role cannot dispatch the replacement.</p>}</>}
        {row.status === 'exchange_dispatched' && row.type === 'exchange' && <>{permissions.canReceive ? <><p>The replacement has been dispatched and deducted from stock.</p><button className="primary-button" disabled={busy} onClick={() => onStep('exchanged')}>Mark replacement delivered</button></> : <p title="Requires refunds:receive">Your role cannot complete this exchange.</p>}</>}
        {row.status === 'received' && row.type !== 'exchange' && <>{permissions.canPay ? <><p className="refund-demo-note">Razorpay Test Mode · no live money is moved.</p><label>Refund amount (up to {money(refundLimit)})<input type="number" min="0.01" max={refundLimit} step="0.01" value={refundAmount} onChange={event => setRefundAmount(event.target.value)} /></label>{isPartialRefund && <label>Reason for partial refund<textarea value={refundReason} maxLength={500} onChange={event => setRefundReason(event.target.value)} /></label>}<button className="primary-button" disabled={busy || !refundAmountValid} onClick={() => { if (window.confirm(`Issue a Razorpay test refund of ${money(Number(refundAmount))}?`)) onStep('refunded', undefined, { p_final_amount: Number(refundAmount), p_final_amount_reason: isPartialRefund ? refundReason.trim() : null }) }}>Refund {money(Number(refundAmount) || 0)}</button></> : <p title="Requires refunds:pay">Your role cannot issue a refund.</p>}</>}
        {row.status === 'refunded' && <p className="refund-demo-note">Razorpay refund {row.refund_reference ?? 'accepted'} · Test Mode</p>}
        {row.status === 'rejected' && <p>Rejection note: {row.decision_note ?? 'No note recorded.'}</p>}
        {row.status === 'cancelled' && <p>The customer cancelled this request.</p>}
        <Link href={`/portal/${process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN ?? ''}/complaints?order=${row.order_id}`}>Open complaint for order #{row.order_id}</Link>
      </section></div><footer><Link href={`${portalOrders}?order=${row.order_id}`}>Order details</Link><button className="secondary-button" onClick={onClose}>Close</button></footer></aside></div>
}
