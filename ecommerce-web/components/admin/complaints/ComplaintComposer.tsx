'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import Link from 'next/link'
import { raiseOrderComplaint } from '@/app/admin/complaints/actions'

export type ComplaintOrder = { order_id: number; customer_name: string; total: number; status: string }
type Manager = { user_id: string; full_name: string }

const issueOptions = [
  ['late_delivery', 'Late delivery'], ['wrong_item', 'Wrong item'], ['damaged', 'Damaged item'],
  ['picker_issue', 'Picker issue'], ['payment_refund', 'Payment / refund'], ['other', 'Other'],
]

export function ComplaintComposer({ order, initialOrders, initialManagers, onClose, onCreated }: { order: ComplaintOrder | null; initialOrders: ComplaintOrder[]; initialManagers: Manager[]; onClose: () => void; onCreated: (id: number) => void }) {
  const [orders] = useState<ComplaintOrder[]>(initialOrders)
  const [selectedOrder, setSelectedOrder] = useState(order?.order_id ? String(order.order_id) : '')
  const [managers] = useState<Manager[]>(initialManagers)
  const [issueType, setIssueType] = useState('late_delivery')
  const [severity, setSeverity] = useState('medium')
  const [assignedTo, setAssignedTo] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState<number | null>(null)
  const [existingId, setExistingId] = useState<number | null>(null)

  const pickedOrder = order ?? orders.find(item => String(item.order_id) === selectedOrder) ?? null
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!pickedOrder) { setError('Select an order first.'); return }
    setBusy(true); setError('')
    const result = await raiseOrderComplaint({ orderId: pickedOrder.order_id, issueType, severity, notes, assignedTo: assignedTo || null })
    setBusy(false)
    if (!result.ok) { setError(result.error); setExistingId(result.existingId ?? null); return }
    setCreatedId(result.data ?? null)
    onCreated(result.data ?? 0)
  }

  return <div className="complaint-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="complaint-modal" role="dialog" aria-modal="true" aria-labelledby="complaint-compose-title">
      <header><div><p className="eyebrow">OPERATIONS</p><h2 id="complaint-compose-title">Raise a complaint</h2></div><button type="button" className="icon-button" aria-label="Close complaint form" onClick={onClose}><X size={18} /></button></header>
      {createdId ? <div className="complaint-success"><strong>Complaint #{createdId} created</strong><Link className="primary-button" href={`/portal/${process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN}/complaints?complaint=${createdId}`} onClick={onClose}>View complaint</Link><button className="secondary-button" type="button" onClick={() => onClose()}>Done</button></div> : <form onSubmit={event => void submit(event)}>
        {order ? <div className="complaint-order-preview"><span>Order #{order.order_id} · {order.customer_name}</span><span>{order.status.replaceAll('_',' ')} · ₹{Number(order.total).toLocaleString('en-IN')}</span></div> : <label>Order<select required value={selectedOrder} onChange={event => setSelectedOrder(event.target.value)}><option value="">Select an order</option>{orders.map(item => <option key={item.order_id} value={item.order_id}>#{item.order_id} · {item.customer_name} · ₹{Number(item.total).toLocaleString('en-IN')}</option>)}</select></label>}
        <div className="complaint-form-grid"><label>Issue type<select value={issueType} onChange={event => setIssueType(event.target.value)}>{issueOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Assign to (optional)<select value={assignedTo} onChange={event => setAssignedTo(event.target.value)}><option value="">All store managers</option>{managers.map(manager => <option key={manager.user_id} value={manager.user_id}>{manager.full_name}</option>)}</select></label></div>
        <fieldset className="complaint-severity"><legend>Severity</legend><div>{['low','medium','high'].map(value => <button key={value} type="button" aria-pressed={severity === value} className={`${value} ${severity === value ? 'selected' : ''}`} onClick={() => setSeverity(value)}>{value}</button>)}</div></fieldset>
        <label>Notes<textarea required maxLength={500} rows={4} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Describe what happened and any useful context." /><small className="complaint-character-count">{notes.length}/500</small></label>
        {error && <p className="complaint-form-error" role="alert">{error}{existingId&&<Link href={`/portal/${process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN}/complaints?complaint=${existingId}`} onClick={onClose}>View existing complaint</Link>}</p>}
        <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={busy || !pickedOrder}>{busy ? 'Submitting…' : 'Submit complaint'}</button></footer>
      </form>}
    </section>
  </div>
}
