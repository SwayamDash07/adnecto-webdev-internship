'use client'

import { useEffect, useState, type KeyboardEvent } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Clock3, MapPin, Package, UserRound, X } from 'lucide-react'
import Link from 'next/link'
import { money } from '@/lib/formatters'
import { allowedOrderStatuses } from '@/constants/admin-orders'
import type { AdminOrder } from '@/types/admin-orders'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatDeliverySlot } from '@/lib/delivery-slot'
import { useIstNow } from '@/hooks/use-ist-now'

const statusLabel = (status: string) => status.replaceAll('_', ' ')
const statusClass = (status: string) => `order-status-${status.replaceAll('_', '-')}`
const formatDate = (date: string) => new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

type StatusToast = { kind: 'success' | 'error'; message: string }
type RefundRow = { id:number; amount:number; final_amount:number|null; type:string; pickup_slot:string|null; picked_up_at:string|null; received_at:string|null; item_condition:string|null; condition_note:string|null; status:string; reason:string; comment:string|null; decision_note:string|null; photo_paths:string[]|null; created_at:string; updated_at:string; decided_at:string|null; refund_items:{quantity:number;amount:number;order_items:{products:{name:string}|{name:string}[]|null}|null}[]|null; refund_events:{to_status:string;note:string|null;created_at:string}[]|null }

export function OrderQueueTable({ loading, error, allOrders, visibleOrders, page, setPage, busy, updateStatus, query, status, setQuery, setStatus, onRetry }: { loading: boolean; error: string; allOrders: AdminOrder[]; visibleOrders: AdminOrder[]; page: number; setPage: (value: number | ((current: number) => number)) => void; busy: number | null; updateStatus: (orderId: number, nextStatus: string) => void | Promise<void>; query: string; status: string; setQuery: (value: string) => void; setStatus: (value: string) => void; onRetry: () => void }) {
  const now = useIstNow()
  const [rowsPerPage, setRowsPerPage] = useState(8)
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const [confirmChange, setConfirmChange] = useState<{ order: AdminOrder; nextStatus: string } | null>(null)
  const [pendingChange, setPendingChange] = useState<{ orderId: number; nextStatus: string } | null>(null)
  const [toast, setToast] = useState<StatusToast | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [refundRows, setRefundRows] = useState<RefundRow[]>([])
  const [refundBusy, setRefundBusy] = useState<number|null>(null)
  const [rejectingRefund, setRejectingRefund] = useState<number|null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [refundError, setRefundError] = useState('')
  const [pickupSlots,setPickupSlots]=useState<Record<number,string>>({})
  const [conditions,setConditions]=useState<Record<number,string>>({})
  const [conditionNotes,setConditionNotes]=useState<Record<number,string>>({})
  const [finalAmounts,setFinalAmounts]=useState<Record<number,string>>({})
  const [finalReasons,setFinalReasons]=useState<Record<number,string>>({})
  const [refundPhotoUrls, setRefundPhotoUrls] = useState<Record<string,string>>({})
  const totalPages = Math.max(1, Math.ceil(visibleOrders.length / rowsPerPage))
  const pageRows = visibleOrders.slice((page - 1) * rowsPerPage, page * rowsPerPage)

  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, setPage, totalPages])
  useEffect(() => {
    if (!openMenu && !confirmChange && !selectedOrder) return
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpenMenu(null)
      setConfirmChange(null)
      setSelectedOrder(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [confirmChange, openMenu, selectedOrder])

  useEffect(() => {
    if (!pendingChange) return
    if (error.startsWith('Could not update order:')) {
      setToast({ kind: 'error', message: error })
      setPendingChange(null)
      return
    }
    if (allOrders.some(order => order.order_id === pendingChange.orderId && order.status === pendingChange.nextStatus)) {
      setToast({ kind: 'success', message: `Order #${pendingChange.orderId} is now ${statusLabel(pendingChange.nextStatus)}.` })
      setPendingChange(null)
    }
  }, [allOrders, error, pendingChange])
  useEffect(()=>{if(!selectedOrder){setRefundRows([]);return}let active=true;const client=createSupabaseBrowserClient();if(!client)return;void client.from('refunds').select('id,amount,final_amount,type,pickup_slot,picked_up_at,received_at,item_condition,condition_note,status,reason,comment,decision_note,photo_paths,created_at,updated_at,decided_at,refund_items(quantity,amount,order_items(products(name))),refund_events(to_status,note,created_at)').eq('order_id',selectedOrder.order_id).order('created_at',{ascending:false}).then(({data,error})=>{if(!active)return;if(error)setRefundError(error.message);else{setRefundError('');setRefundRows((data??[]) as unknown as RefundRow[])}});return()=>{active=false}},[selectedOrder?.order_id])
  useEffect(() => {
    let active = true
    const client = createSupabaseBrowserClient()
    if (!client) return
    const paths = [...new Set(refundRows.flatMap(refund => refund.photo_paths ?? []))]
    void Promise.all(paths.map(async path => {
      const { data } = await client.storage.from('refund-photos').createSignedUrl(path, 3600)
      return [path, data?.signedUrl] as const
    })).then(entries => {
      if (active) setRefundPhotoUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))))
    })
    return () => { active = false }
  }, [refundRows])

  async function updateRefund(refundId:number,status:string,note?:string,extra:Record<string,unknown>={}){const client=createSupabaseBrowserClient();if(!client)return;setRefundBusy(refundId);setRefundError('');const {error}=await client.rpc('set_refund_status',{p_refund_id:refundId,p_status:status,p_note:note??null,...extra});if(error)setRefundError(error.message);else{const {data}=await client.from('refunds').select('id,amount,final_amount,type,pickup_slot,picked_up_at,received_at,item_condition,condition_note,status,reason,comment,decision_note,photo_paths,created_at,updated_at,decided_at,refund_items(quantity,amount,order_items(products(name))),refund_events(to_status,note,created_at)').eq('order_id',selectedOrder?.order_id).order('created_at',{ascending:false});setRefundRows((data??[]) as unknown as RefundRow[]);onRetry()}setRefundBusy(null);setRejectingRefund(null);setRejectNote('')}

  async function changeStatus(order: AdminOrder, nextStatus: string) {
    setOpenMenu(null)
    setToast(null)
    setPendingChange({ orderId: order.order_id, nextStatus })
    try { await updateStatus(order.order_id, nextStatus) }
    catch { setToast({ kind: 'error', message: `Could not update order #${order.order_id}. Please try again.` }); setPendingChange(null) }
  }

  function requestStatus(order: AdminOrder, nextStatus: string) {
    if (nextStatus === 'cancelled' || nextStatus === 'refunded') setConfirmChange({ order, nextStatus })
    else void changeStatus(order, nextStatus)
  }

  function openOrder(order: AdminOrder) { setSelectedOrder(order) }
  function onRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, order: AdminOrder) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openOrder(order) }
  }

  if (error && !error.startsWith('Could not update order:')) return <section className="order-error-state" role="alert"><strong>We couldn’t load the orders</strong><span>{error}</span><button type="button" className="secondary-button" onClick={onRetry}>Retry</button></section>

  return <>
    {toast && <div className={`order-status-toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}><span>{toast.message}</span><button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={15} /></button></div>}
    {loading ? <div className="order-skeletons" aria-label="Loading orders" aria-busy="true">{Array.from({ length: 5 }, (_, index) => <div className="order-skeleton-row" key={index}><i /><i /><i /><i /><i /></div>)}</div> : visibleOrders.length ? <>
      <div className="order-table-viewport"><table className="order-table"><thead><tr><th>Order</th><th>Customer</th><th className="numeric">Total</th><th>Address</th><th>Status</th></tr></thead><tbody>{pageRows.map(order => <tr key={order.order_id} tabIndex={0} aria-label={`Open order ${order.order_id}`} onClick={() => openOrder(order)} onKeyDown={event => onRowKeyDown(event, order)}>
        <td><strong className="order-number">#{order.order_id}</strong><small className="order-meta">{formatDate(order.created_at)}</small></td>
        <td><strong className="order-customer-name" title={order.customer_name}>{order.customer_name}</strong><small className="order-meta order-customer-email" title={order.customer_email}>{order.customer_email}</small></td>
        <td className="numeric"><strong className="order-total">{money(Number(order.total))}</strong><small className="order-meta">{order.item_count} {order.item_count === 1 ? 'item' : 'items'}</small></td>
        <td><span className="order-address" title={order.address_line || 'No address provided'}>{order.address_line || 'No address provided'}</span></td>
        <td onClick={event => event.stopPropagation()}><div className="order-status-control"><button type="button" className={`order-status-pill ${statusClass(order.status)}${busy === order.order_id ? ' is-loading' : ''}`} aria-haspopup="true" aria-expanded={openMenu === order.order_id} aria-label={`Change status for order ${order.order_id}. Current status: ${statusLabel(order.status)}`} disabled={busy === order.order_id || allowedOrderStatuses(order.status).length <= 1} onClick={() => setOpenMenu(openMenu === order.order_id ? null : order.order_id)}><i />{busy === order.order_id ? 'Updating…' : statusLabel(order.status)}{allowedOrderStatuses(order.status).length > 1 && <ChevronDown size={13} />}</button>{openMenu === order.order_id && <div className="order-status-menu" role="group" aria-label={`Status options for order ${order.order_id}`}>{allowedOrderStatuses(order.status).filter(nextStatus => nextStatus !== order.status).map(nextStatus => <button type="button" key={nextStatus} onClick={() => requestStatus(order, nextStatus)}><i className={statusClass(nextStatus)} />{statusLabel(nextStatus)}</button>)}</div>}</div></td>
      </tr>)}</tbody></table></div>
      <div className="order-mobile-list">{pageRows.map(order => <article className="order-mobile-card" key={order.order_id} tabIndex={0} role="button" aria-label={`Open order ${order.order_id}`} onClick={() => openOrder(order)} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openOrder(order) } }}>
        <div className="order-mobile-top"><div><strong>#{order.order_id}</strong><small>{formatDate(order.created_at)}</small></div><div onClick={event => event.stopPropagation()}><div className="order-status-control"><button type="button" className={`order-status-pill ${statusClass(order.status)}${busy === order.order_id ? ' is-loading' : ''}`} aria-haspopup="true" aria-expanded={openMenu === order.order_id} aria-label={`Change status for order ${order.order_id}. Current status: ${statusLabel(order.status)}`} disabled={busy === order.order_id || allowedOrderStatuses(order.status).length <= 1} onClick={() => setOpenMenu(openMenu === order.order_id ? null : order.order_id)}><i />{busy === order.order_id ? 'Updating…' : statusLabel(order.status)}{allowedOrderStatuses(order.status).length > 1 && <ChevronDown size={13} />}</button>{openMenu === order.order_id && <div className="order-status-menu" role="group" aria-label={`Status options for order ${order.order_id}`}>{allowedOrderStatuses(order.status).filter(nextStatus => nextStatus !== order.status).map(nextStatus => <button type="button" key={nextStatus} onClick={() => requestStatus(order, nextStatus)}><i className={statusClass(nextStatus)} />{statusLabel(nextStatus)}</button>)}</div>}</div></div></div>
        <div className="order-mobile-details"><div className="order-mobile-customer"><strong title={order.customer_name}>{order.customer_name}</strong><small title={order.customer_email}>{order.customer_email}</small></div><div className="order-mobile-total"><strong>{money(Number(order.total))}</strong><small>{order.item_count} {order.item_count === 1 ? 'item' : 'items'}</small></div></div>
        <div className="order-mobile-address"><MapPin size={14} /><span title={order.address_line || 'No address provided'}>{order.address_line || 'No address provided'}</span></div>
      </article>)}</div>
      <div className="order-pagination"><label>Rows per page<select value={rowsPerPage} onChange={event => { setRowsPerPage(Number(event.target.value)); setPage(1) }}><option value={8}>8</option><option value={16}>16</option><option value={32}>32</option></select></label><span>Page {page} of {totalPages}</span><div><button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={16} /></button><button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page >= totalPages} aria-label="Next page"><ChevronRight size={16} /></button></div></div>
    </> : <section className="order-empty-state"><span><Package size={23} /></span><strong>No orders match your filters</strong><p>Try changing your search or status filter.</p><button type="button" className="secondary-button" onClick={() => { setQuery(''); setStatus('') }}>Clear filters</button></section>}

    {confirmChange && <div className="order-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setConfirmChange(null) }}><section className="order-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="order-confirm-title"><h3 id="order-confirm-title">Confirm {statusLabel(confirmChange.nextStatus)}?</h3><p>Change order <strong>#{confirmChange.order.order_id}</strong> to {statusLabel(confirmChange.nextStatus)}?</p><div><button type="button" className="secondary-button" onClick={() => setConfirmChange(null)}>Keep current status</button><button type="button" className="order-danger-button" onClick={() => { const pending = confirmChange; setConfirmChange(null); void changeStatus(pending.order, pending.nextStatus) }}>Confirm change</button></div></section></div>}
    {selectedOrder && <aside className="order-drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedOrder(null) }}><section className="order-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="order-drawer-title"><header><div><span className="order-drawer-eyebrow">ORDER DETAILS</span><h2 id="order-drawer-title">Order #{selectedOrder.order_id}</h2></div><button type="button" className="order-icon-button" aria-label="Close order details" onClick={() => setSelectedOrder(null)}><X size={19} /></button></header><div className="order-drawer-body"><div className="order-drawer-status"><span className={`order-status-pill ${statusClass(selectedOrder.status)}`}><i />{statusLabel(selectedOrder.status)}</span><span>Placed {formatDate(selectedOrder.created_at)}</span></div><section><h3><UserRound size={16} />Customer</h3><strong>{selectedOrder.customer_name}</strong><span>{selectedOrder.customer_email}</span></section><section><h3><Package size={16} />Order items</h3><div className="order-drawer-item"><span>{selectedOrder.item_count} {selectedOrder.item_count === 1 ? 'item' : 'items'}</span><strong>{money(Number(selectedOrder.total))}</strong></div></section><section><h3><MapPin size={16} />Delivery address</h3><p>{selectedOrder.address_line || 'No address provided'}</p>{formatDeliverySlot(selectedOrder,now).display && <span className="order-drawer-slot"><Clock3 size={14} />{formatDeliverySlot(selectedOrder,now).display}</span>}</section><section><h3><Clock3 size={16} />Timeline</h3><div className="order-timeline"><div><i /><span><strong>Order placed</strong><small>{formatDate(selectedOrder.created_at)}</small></span></div><div><i /><span><strong>Current status: {statusLabel(selectedOrder.status)}</strong><small>Latest fulfilment status</small></span></div></div></section><section className="admin-refund-section"><h3>Refunds</h3>{refundError&&<p role="alert">{refundError}</p>}{refundRows.length===0&&!refundError?<p>No refund requests.</p>:refundRows.map(refund=><article key={refund.id}><header><strong>{money(Number(refund.final_amount??refund.amount))}</strong><span className={`refund-status-pill ${refund.status}`}>{refund.status}</span></header><p><b>Reason:</b> {refund.reason}</p>{refund.comment&&<p><b>Comment:</b> {refund.comment}</p>}{(refund.photo_paths??[]).length>0&&<div className="admin-refund-photos" aria-label="Customer refund photos">{refund.photo_paths!.map((path,index)=>{const storage=refundPhotoUrls[path];return storage?<a href={storage} target="_blank" rel="noreferrer" key={path}><img src={storage} alt={`Customer refund photo ${index+1}`}/></a>:null})}</div>}<div>{(refund.refund_items??[]).map((item,index)=>{const product=Array.isArray(item.order_items?.products)?item.order_items?.products[0]:item.order_items?.products;return <p key={index}>{product?.name??'Item'} × {item.quantity} · {money(Number(item.amount))}</p>})}</div>{(refund.refund_events??[]).length?refund.refund_events!.map((event,index)=><p className="admin-refund-timeline" key={index}>{event.to_status} · {new Date(event.created_at).toLocaleString('en-IN')}{event.note?` · ${event.note}`:''}</p>):<p className="admin-refund-timeline">Requested · {new Date(refund.created_at).toLocaleString('en-IN')}</p>}{refund.status==='requested'&&<div className="admin-refund-actions"><button type="button" className="primary-button" disabled={refundBusy===refund.id} onClick={()=>void updateRefund(refund.id,'approved')}>Approve</button>{rejectingRefund===refund.id?<div><textarea aria-label="Required rejection note" value={rejectNote} maxLength={500} onChange={event=>setRejectNote(event.target.value)} placeholder="Explain why this request is rejected"/><button type="button" className="order-danger-button" disabled={!rejectNote.trim()||refundBusy===refund.id} onClick={()=>void updateRefund(refund.id,'rejected',rejectNote)}>Confirm reject</button></div>:<button type="button" className="order-danger-button" onClick={()=>setRejectingRefund(refund.id)}>Reject</button>}</div>}{refund.status==='approved'&&refund.type==='return_and_refund'&&<div className="admin-refund-workflow"><label>Pickup slot<select value={pickupSlots[refund.id]??refund.pickup_slot??''} onChange={e=>setPickupSlots(v=>({...v,[refund.id]:e.target.value}))}><option value="">Choose pickup slot</option>{Array.from({length:3},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i+1);const day=d.toISOString().slice(0,10);return [`${day} | 10:00-12:00`,`${day} | 16:00-18:00`]}).flat().map(slot=><option key={slot}>{slot}</option>)}</select></label><button className="primary-button" disabled={!pickupSlots[refund.id]&&!refund.pickup_slot||refundBusy===refund.id} onClick={()=>void updateRefund(refund.id,'pickup_scheduled',undefined,{p_pickup_slot:pickupSlots[refund.id]??refund.pickup_slot})}>Schedule pickup</button></div>}{refund.status==='approved'&&refund.type==='refund_only'&&<button type="button" className="primary-button" disabled={refundBusy===refund.id} onClick={()=>void updateRefund(refund.id,'refunded')}>Mark refunded</button>}{refund.status==='pickup_scheduled'&&<button type="button" className="primary-button" disabled={refundBusy===refund.id} onClick={()=>void updateRefund(refund.id,'picked_up')}>Mark picked up</button>}{refund.status==='picked_up'&&<div className="admin-refund-workflow"><label>Item condition<select value={conditions[refund.id]??''} onChange={e=>setConditions(v=>({...v,[refund.id]:e.target.value}))}><option value="">Choose condition</option><option>Good</option><option>Damaged</option><option>Missing items</option></select></label>{['Damaged','Missing items'].includes(conditions[refund.id]??'')&&<p className="refund-condition-warning">The team may reduce or reject the refund.</p>}<label>Condition note<textarea value={conditionNotes[refund.id]??''} onChange={e=>setConditionNotes(v=>({...v,[refund.id]:e.target.value}))} placeholder="Describe the item condition"/></label><p>Add the stock back on the Inventory page if the item is resellable. <Link href={`/portal/${process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN ?? ''}/inventory`}>Open Inventory</Link></p><button className="primary-button" disabled={!conditions[refund.id]||!conditionNotes[refund.id]?.trim()||refundBusy===refund.id} onClick={()=>void updateRefund(refund.id,'received',undefined,{p_condition:conditions[refund.id],p_condition_note:conditionNotes[refund.id]})}>Mark received</button></div>}{refund.status==='received'&&<div className="admin-refund-workflow"><p>Condition: {refund.item_condition} · {refund.condition_note}</p>{['Damaged','Missing items'].includes(refund.item_condition??'')&&<><p className="refund-condition-warning">The team may reduce or reject the refund. Final amount cannot exceed {money(Number(refund.amount))}.</p><label>Final refund amount<input type="number" min="0" max={refund.amount} step="0.01" value={finalAmounts[refund.id]??String(refund.amount)} onChange={e=>setFinalAmounts(v=>({...v,[refund.id]:e.target.value}))}/></label>{Number(finalAmounts[refund.id]??refund.amount)<Number(refund.amount)&&<label>Required reason<textarea value={finalReasons[refund.id]??''} onChange={e=>setFinalReasons(v=>({...v,[refund.id]:e.target.value}))}/></label>}</>}<p className="admin-refund-demo">Demo: no money is moved.</p><button className="primary-button" disabled={refundBusy===refund.id||(['Damaged','Missing items'].includes(refund.item_condition??'')&&Number(finalAmounts[refund.id]??refund.amount)<Number(refund.amount)&&!finalReasons[refund.id]?.trim())} onClick={()=>void updateRefund(refund.id,'refunded',undefined,{p_final_amount:['Damaged','Missing items'].includes(refund.item_condition??'')?Number(finalAmounts[refund.id]??refund.amount):null,p_final_amount_reason:finalReasons[refund.id]??null})}>Mark refunded</button></div>}</article>)}</section></div></section></aside>}
  </>
}

