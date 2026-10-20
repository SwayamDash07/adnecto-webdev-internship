'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight, CircleAlert, Copy, Mail, PackagePlus, Plus, RefreshCw, Search, X } from 'lucide-react'
import { AdminShell } from '../admin-shell'
import { Can } from '@/lib/use-can'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRealtimeReload } from '@/lib/use-realtime-reload'
import type { AdminProduct, PurchaseOrder } from '@/types/admin'

type StatusFilter = 'all' | 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled'
const statusLabel = (value: string) => value === 'ordered' ? 'Sent' : value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const date = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const poNumber = (order: PurchaseOrder) => `PO-${String(order.purchase_order_id).padStart(4, '0')}`

export function LivePurchaseManagerV2({ initialOrders, initialProducts, initialName, initialError, initialFilters }: { initialOrders: PurchaseOrder[]; initialProducts: AdminProduct[]; initialName: string; initialError: string; initialFilters: { search: string; status: string; supplier: string; sort: string; page: string } }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>(initialOrders)
  const [products, setProducts] = useState<AdminProduct[]>(initialProducts)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)
  const [query, setQuery] = useState(initialFilters.search)
  const [status, setStatus] = useState<StatusFilter>((initialFilters.status || 'all') as StatusFilter)
  const [supplier, setSupplier] = useState(initialFilters.supplier || 'all')
  const [sort, setSort] = useState(initialFilters.sort || 'newest')
  const [page, setPage] = useState(Math.max(1, Number(initialFilters.page) || 1))
  const [pageSize, setPageSize] = useState(10)
  const [drawer, setDrawer] = useState<'create' | 'detail' | null>(null)
  const [selected, setSelected] = useState<PurchaseOrder | null>(null)
  const [form, setForm] = useState({ productId: '', quantity: '1', supplier: '', supplierEmail: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmSend, setConfirmSend] = useState<PurchaseOrder | null>(null)
  const [confirmReceive, setConfirmReceive] = useState<PurchaseOrder | null>(null)
  const [pendingCreated, setPendingCreated] = useState<PurchaseOrder | null>(null)
  const [transitioningId, setTransitioningId] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [adminName, setAdminName] = useState(initialName)

  async function load() {
    setLoading(true); setError('')
    const client = createSupabaseBrowserClient()
    if (!client) { setError('Supabase is not configured.'); setLoading(false); return }
    const [ordersResult, productsResult, profileResult] = await Promise.all([client.rpc('admin_list_purchase_orders'), client.rpc('admin_list_products'), client.rpc('get_my_admin_profile')])
    if (ordersResult.error) setError(ordersResult.error.message)
    else setOrders((ordersResult.data ?? []) as PurchaseOrder[])
    if (!productsResult.error) setProducts((productsResult.data ?? []) as AdminProduct[])
    const profile = profileResult.data?.[0]
    if (profile?.full_name) setAdminName(String(profile.full_name))
    setLoading(false)
  }
  useEffect(() => { const timer = window.setTimeout(() => { const url = new URL(window.location.href); const values = { search: query.trim(), status: status === 'all' ? '' : status, supplier: supplier === 'all' ? '' : supplier, sort: sort === 'newest' ? '' : sort, page: page > 1 ? String(page) : '' }; for (const [key, value] of Object.entries(values)) { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key) } window.history.replaceState(null, '', url.pathname + url.search) }, 300); return () => window.clearTimeout(timer) }, [query, status, supplier, sort, page])
  useRealtimeReload('admin-purchase-orders-v2-live', ['purchase_orders', 'purchase_items', 'products', 'inventory'], () => { void load() })

  const suppliers = useMemo(() => Array.from(new Set(orders.map(order => order.supplier_name).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [orders])
  const counts = useMemo(() => orders.reduce<Record<string, number>>((all, order) => { all[order.status] = (all[order.status] ?? 0) + 1; return all }, {}), [orders])
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return [...orders].filter(order => (!term || `po-${String(order.purchase_order_id).padStart(4, '0')} ${order.purchase_order_id} ${order.supplier_name}`.toLowerCase().includes(term)) && (status === 'all' || order.status === status) && (supplier === 'all' || order.supplier_name === supplier)).sort((a, b) => sort === 'oldest' ? +new Date(a.created_at) - +new Date(b.created_at) : +new Date(b.created_at) - +new Date(a.created_at))
  }, [orders, query, status, supplier, sort])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const resetPage = () => setPage(1)

  function validate() {
    const errors: Record<string, string> = {}
    if (!form.supplier.trim()) errors.supplier = 'Enter a supplier name.'
    if (!form.productId) errors.productId = 'Select a product.'
    if (!/^\d+$/.test(form.quantity) || Number(form.quantity) < 1) errors.quantity = 'Quantity must be a whole number of at least 1.'
    if (form.supplierEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.supplierEmail)) errors.supplierEmail = 'Enter a valid email address.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }
  async function createOrder(event: React.FormEvent) {
    event.preventDefault()
    if (!validate()) return
    const client = createSupabaseBrowserClient(); if (!client) return
    setSaving(true)
    const selectedProduct = products.find(item => String(item.product_id) === form.productId)
    const { data: newId, error: createError } = await client.rpc('admin_create_purchase_order', { p_supplier_name: form.supplier.trim(), p_product_id: Number(form.productId), p_quantity: Number(form.quantity), p_unit_cost: 0, p_supplier_email: form.supplierEmail.trim() || null })
    setSaving(false)
    if (createError) { setToast(createError.message); return }
    const createdOrder: PurchaseOrder = { purchase_order_id: Number(newId), supplier_name: form.supplier.trim(), status: 'draft', created_at: new Date().toISOString(), item_count: 1, quantity: Number(form.quantity), supplier_email: form.supplierEmail.trim() || null, product_summary: `${selectedProduct?.product_name ?? 'Product'} (SKU ${selectedProduct?.sku || '—'}) x ${form.quantity}` }
    setPendingCreated(createdOrder); setSelected(createdOrder); setDrawer('detail'); setForm({ productId: '', quantity: '1', supplier: '', supplierEmail: '' }); setFieldErrors({}); setToast('Purchase order created.')
    setStatus('all'); setSupplier('all'); setQuery(''); setPage(1); await load()
  }

  function mailMessage(order: PurchaseOrder) {
    const subject = `Purchase order ${poNumber(order)} from Cartly Hypermarket`
    const lines = order.product_summary || 'Product details unavailable'
    const body = `Hello ${order.supplier_name},\n\nWe'd like to place the following order:\n- ${lines}\n\nPlease reply with your best price and expected delivery date.\n\nThanks,\n${adminName}, Cartly Hypermarket`
    return { subject, body }
  }
  function withSessionEmail(order: PurchaseOrder) {
    return pendingCreated?.purchase_order_id === order.purchase_order_id && !order.supplier_email
      ? { ...order, supplier_email: pendingCreated.supplier_email }
      : order
  }
  function openMail(order: PurchaseOrder) {
    const target = withSessionEmail(order)
    const { subject, body } = mailMessage(target)
    const recipient = target.supplier_email || ''
    window.open(`mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank', 'noopener,noreferrer')
    setConfirmSend(target)
  }
  async function copyMessage(order: PurchaseOrder) {
    const target = withSessionEmail(order)
    const { subject, body } = mailMessage(target)
    try { await navigator.clipboard.writeText(`To: ${target.supplier_email || ''}\nSubject: ${subject}\n\n${body}`); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
    catch { setToast('Could not copy the message. Check clipboard permissions.') }
  }
  async function setOrderStatus(order: PurchaseOrder, nextStatus: 'ordered' | 'received') {
    if (transitioningId !== null) return
    const client = createSupabaseBrowserClient(); if (!client) return
    setTransitioningId(order.purchase_order_id)
    const { data, error: transitionError } = await client.rpc('set_purchase_order_status', { po_id: order.purchase_order_id, new_status: nextStatus })
    setTransitioningId(null)
    if (transitionError) { setToast(transitionError.message); return }
    const returned = Array.isArray(data) ? data[0] : data
    const updated = { ...order, status: nextStatus, sent_at: returned?.sent_at ?? order.sent_at ?? (nextStatus === 'ordered' ? new Date().toISOString() : null), received_at: returned?.received_at ?? order.received_at ?? (nextStatus === 'received' ? new Date().toISOString() : null) }
    setOrders(current => current.map(item => item.purchase_order_id === order.purchase_order_id ? { ...item, ...updated } : item))
    setSelected(current => current?.purchase_order_id === order.purchase_order_id ? { ...current, ...updated } : current)
    setPendingCreated(current => current?.purchase_order_id === order.purchase_order_id ? { ...current, ...updated } : current)
    setConfirmSend(null); setConfirmReceive(null)
    setToast(nextStatus === 'ordered' ? 'Sent to supplier.' : 'Purchase order marked received.')
    await load()
  }

  const openCreate = () => { setForm({ productId: '', quantity: '1', supplier: '', supplierEmail: '' }); setFieldErrors({}); setDrawer('create') }
  const activeFilters = query || status !== 'all' || supplier !== 'all'
  const clearFilters = () => { setQuery(''); setStatus('all'); setSupplier('all'); setPage(1) }
  const product = products.find(item => String(item.product_id) === form.productId)
  const formDirty = !!(form.supplier.trim() || form.productId || form.supplierEmail || form.quantity !== '1')
  const closeDrawer = () => {
    if (drawer === 'create' && formDirty && !confirmDiscard) { setConfirmDiscard(true); return }
    setConfirmDiscard(false); setDrawer(null)
  }

  return <AdminShell title="Purchase orders" description="Order stock from suppliers and track what's arriving." action={<Can permission="purchase_orders:manage"><button className="primary-button po-new-button" onClick={openCreate}><Plus size={17} />New purchase order</button></Can>}>
    <main className="po-page">
      <section className="po-stats" aria-label="Purchase order summary">
        <button onClick={() => { setStatus('draft'); resetPage() }}><span>Open POs</span><strong>{loading ? '—' : orders.filter(order => ['draft', 'ordered', 'partially_received'].includes(order.status)).length}</strong><small>Draft, ordered, or partial</small></button>
        <button onClick={() => { setStatus('ordered'); resetPage() }}><span>Awaiting delivery</span><strong>{loading ? '—' : counts.ordered ?? 0}</strong><small>Ordered with supplier</small></button>
        <button onClick={() => { setStatus('received'); resetPage() }}><span>Received this month</span><strong>{loading ? '—' : orders.filter(order => order.received_at && new Date(order.received_at).getMonth() === new Date().getMonth() && new Date(order.received_at).getFullYear() === new Date().getFullYear()).length}</strong><small>Marked received this month</small></button>
        <button onClick={() => { setStatus('cancelled'); resetPage() }}><span>Cancelled</span><strong>{loading ? '—' : counts.cancelled ?? 0}</strong><small>Closed without receipt</small></button>
      </section>

      <section className="po-queue-card" aria-label="Purchase order queue">
        <header className="po-queue-heading"><div><h2>Purchase order queue</h2><p>{loading ? 'Loading purchase orders…' : `Showing ${filtered.length} purchase ${filtered.length === 1 ? 'order' : 'orders'}`}</p></div><button className="po-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? 'po-spin' : ''} />Refresh</button></header>
        <div className="po-toolbar">
          <label className="po-search"><Search size={16}/><input value={query} onChange={event => { setQuery(event.target.value); resetPage() }} placeholder="Search PO or supplier" aria-label="Search purchase orders" /></label>
          <select value={supplier} onChange={event => { setSupplier(event.target.value); resetPage() }} aria-label="Filter by supplier"><option value="all">All suppliers</option>{suppliers.map(name => <option key={name} value={name}>{name}</option>)}</select>
          <select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort purchase orders"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
          {activeFilters && <button className="po-clear" onClick={clearFilters}>Clear filters</button>}
        </div>
        <div className="po-status-filters" role="group" aria-label="Filter by status">{(['all', 'draft', 'ordered', 'partially_received', 'received', 'cancelled'] as StatusFilter[]).map(value => <button key={value} className={status === value ? 'active' : ''} onClick={() => { setStatus(value); resetPage() }}>{value === 'all' ? 'All' : statusLabel(value)}<span>{value === 'all' ? orders.length : counts[value] ?? 0}</span></button>)}</div>
        {error ? <div className="po-state"><CircleAlert size={24}/><strong>Purchase orders couldn’t be loaded</strong><p>Check the connection and try again.</p><button className="secondary-button" onClick={() => void load()}>Retry</button></div> : loading ? <div className="po-skeleton" aria-label="Loading purchase orders">{Array.from({ length: 6 }, (_, index) => <i key={index}/>)}</div> : !filtered.length ? <div className="po-state"><PackagePlus size={25}/><strong>{orders.length ? 'No results' : 'No purchase orders yet'}</strong><p>{orders.length ? 'No purchase orders match these filters.' : 'Create a purchase order to start tracking supplier stock.'}</p>{orders.length ? <button className="secondary-button" onClick={clearFilters}>Clear filters</button> : <Can permission="purchase_orders:manage"><button className="primary-button" onClick={openCreate}><Plus size={16}/>Create your first purchase order</button></Can>}</div> : <>
          <div className="po-table-scroll"><table className="po-table"><thead><tr><th>Purchase order</th><th>Product</th><th className="po-num">Quantity</th><th>Supplier</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{pageRows.map(order => <tr key={order.purchase_order_id}>
            <td><strong className="po-number">{poNumber(order)}</strong><small>{order.sent_at ? `Sent ${date(order.sent_at)}` : order.received_at ? `Received ${date(order.received_at)}` : date(order.created_at)}</small></td>
            <td><strong className="po-supplier">{order.product_summary?.split(' (SKU ')[0] || '—'}</strong><small>{order.product_summary?.match(/SKU (.*?)\) x/)?.[1] ? `SKU ${order.product_summary.match(/SKU (.*?)\) x/)?.[1]}` : 'Product details unavailable'}</small></td>
            <td className="po-num">{order.quantity ?? '—'}</td><td><strong className="po-supplier">{order.supplier_name || '—'}</strong></td>
            <td><span className={`po-status-pill ${order.status}`}><i/>{statusLabel(order.status)}</span>{order.status === 'ordered' && order.sent_at && <small className="po-date-chip">Sent {date(order.sent_at)}</small>}{order.status === 'received' && order.received_at && <small className="po-date-chip received">Received {date(order.received_at)}</small>}</td><td>{date(order.created_at)}</td>
            <td><div className="po-row-actions"><button className="po-view" onClick={() => { setSelected(order); setDrawer('detail') }}>View</button><Can permission="purchase_orders:manage">{order.status === 'draft' ? <><button className="po-action-link" onClick={() => openMail(order)}><Mail size={13}/>Send PO</button><button className="po-copy-row" onClick={() => void copyMessage(order)} aria-label={`Copy email for ${poNumber(order)}`} title="Copy message"><Copy size={14}/></button><button className="po-receive-disabled" disabled title="Send the PO first." aria-label="Mark received: send the PO first">Mark received</button></> : order.status === 'ordered' ? <button className="po-action-link" onClick={() => setConfirmReceive(order)}>Mark received</button> : null}</Can></div></td>
          </tr>)}</tbody></table></div>
          <div className="po-mobile-list">{pageRows.map(order => <article className="po-mobile-card" key={order.purchase_order_id}><div className="po-mobile-top"><strong>{poNumber(order)}</strong><span className={`po-status-pill ${order.status}`}><i/>{statusLabel(order.status)}</span></div><div className="po-mobile-data"><span>Product<strong>{order.product_summary?.split(' (SKU ')[0] || '—'}</strong></span><span>Quantity<strong>{order.quantity ?? '—'}</strong></span><span>Supplier<strong>{order.supplier_name || '—'}</strong></span></div><small>{order.status === 'received' && order.received_at ? `Received ${date(order.received_at)}` : order.status === 'ordered' && order.sent_at ? `Sent ${date(order.sent_at)}` : `Created ${date(order.created_at)}`}</small><div className="po-row-actions"><button className="po-view" onClick={() => { setSelected(order); setDrawer('detail') }}>View details</button><Can permission="purchase_orders:manage">{order.status === 'draft' ? <><button className="po-action-link" onClick={() => openMail(order)}><Mail size={13}/>Send PO</button><button className="po-copy-row" onClick={() => void copyMessage(order)} aria-label={`Copy email for ${poNumber(order)}`} title="Copy message"><Copy size={14}/></button><button className="po-receive-disabled" disabled title="Send the PO first.">Mark received</button></> : order.status === 'ordered' ? <button className="po-action-link" onClick={() => setConfirmReceive(order)}>Mark received</button> : null}</Can></div></article>)}</div>
          <footer className="po-pagination"><span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span><label>Rows <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }}><option>10</option><option>25</option><option>50</option></select></label><div><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16}/></button><span>Page {page} of {pageCount}</span><button aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage(page + 1)}><ChevronRight size={16}/></button></div></footer>
        </>}
      </section>
    </main>

    {drawer && <div className="po-drawer-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeDrawer() }}><aside className="po-drawer" role="dialog" aria-modal="true" aria-labelledby="po-drawer-title"><header><div><small>{drawer === 'create' ? 'SUPPLIER ORDER' : 'PURCHASE ORDER'}</small><h2 id="po-drawer-title">{drawer === 'create' ? 'New purchase order' : `PO-${String(selected?.purchase_order_id ?? 0).padStart(4, '0')}`}</h2></div><button className="po-close" aria-label="Close" onClick={closeDrawer}><X size={18}/></button></header>
      {drawer === 'create' ? <form className="po-create-form" onSubmit={event => void createOrder(event)}>
        <section className="po-form-card"><h3>Order details</h3><label className="po-field">Product<select value={form.productId} onChange={event => setForm({ ...form, productId: event.target.value })} onBlur={() => setFieldErrors(current => ({ ...current, productId: form.productId ? '' : 'Select a product.' }))} aria-invalid={!!fieldErrors.productId}><option value="">Select a product</option>{products.map(item => <option key={item.product_id} value={item.product_id}>{item.product_name}{item.sku ? ` · SKU ${item.sku}` : ''} · Stock ${item.current_stock}{item.current_stock <= (item.reorder_level ?? 5) ? ' · LOW STOCK' : ''}</option>)}</select>{fieldErrors.productId && <small>{fieldErrors.productId}</small>}</label>
          <label className="po-field po-quantity-field">Quantity<input type="number" min="1" step="1" value={form.quantity} onChange={event => setForm({ ...form, quantity: event.target.value })} onBlur={() => setFieldErrors(current => ({ ...current, quantity: /^\d+$/.test(form.quantity) && Number(form.quantity) >= 1 ? '' : 'Quantity must be a whole number of at least 1.' }))} aria-invalid={!!fieldErrors.quantity}/>{fieldErrors.quantity && <small>{fieldErrors.quantity}</small>}</label></section>
        <section className="po-form-card"><h3>Supplier</h3><label className="po-field">Supplier name<input list="po-suppliers" value={form.supplier} onChange={event => setForm({ ...form, supplier: event.target.value })} onBlur={() => setFieldErrors(current => ({ ...current, supplier: form.supplier.trim() ? '' : 'Enter a supplier name.' }))} placeholder="Supplier name" aria-invalid={!!fieldErrors.supplier}/><datalist id="po-suppliers">{suppliers.map(name => <option key={name} value={name}/>)}</datalist>{fieldErrors.supplier && <small>{fieldErrors.supplier}</small>}</label><label className="po-field po-email-field">Supplier email (optional)<input type="email" value={form.supplierEmail} onChange={event => setForm({ ...form, supplierEmail: event.target.value })} onBlur={() => setFieldErrors(current => ({ ...current, supplierEmail: form.supplierEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.supplierEmail) ? 'Enter a valid email address.' : '' }))} placeholder="supplier@example.com" aria-invalid={!!fieldErrors.supplierEmail}/>{fieldErrors.supplierEmail && <small>{fieldErrors.supplierEmail}</small>}</label></section>
        <section className="po-form-card"><h3>Summary</h3><div className="po-summary-row"><span>{product?.product_name || 'Select a product'} × {Number(form.quantity || 0)}</span></div><p>Price will be confirmed with the supplier.</p></section>
        <footer><button type="button" className="secondary-button" onClick={closeDrawer} disabled={saving}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Creating…' : 'Create purchase order'}</button></footer>
      </form> : <div className="po-detail-content"><div className="po-detail-status"><span className={`po-status-pill ${selected?.status ?? ''}`}><i/>{statusLabel(selected?.status ?? 'unknown')}</span>{selected?.status === 'ordered' && selected.sent_at && <span className="po-date-chip">Sent {date(selected.sent_at)}</span>}{selected?.status === 'received' && selected.received_at && <span className="po-date-chip received">Received {date(selected.received_at)}</span>}</div>
        {selected && pendingCreated?.purchase_order_id === selected.purchase_order_id && selected.status === 'draft' && <section className="po-created-success"><Check size={17}/><div><strong>Purchase order created</strong><span>Send the order details by email when you’re ready.</span></div></section>}
        <dl><div><dt>Supplier</dt><dd>{selected?.supplier_name || '—'}</dd></div><div><dt>Supplier email</dt><dd>{selected?.supplier_email || 'Not provided'}</dd></div><div><dt>Created</dt><dd>{selected?.created_at ? date(selected.created_at) : '—'}</dd></div><div><dt>Product</dt><dd>{selected?.product_summary || 'Product details unavailable'}</dd></div><div><dt>Quantity</dt><dd>{selected?.quantity ?? '—'}</dd></div>{selected?.sent_at && <div><dt>Sent</dt><dd>{date(selected.sent_at)}</dd></div>}{selected?.received_at && <div><dt>Received</dt><dd>{date(selected.received_at)}</dd></div>}</dl>
        <section className="po-detail-notice"><PackagePlus size={18}/><p>When the goods arrive, add the stock on the <Link href={`/portal/${process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN ?? ''}/inventory`}>Inventory page</Link>.</p></section>
        <Can permission="purchase_orders:manage"><div className="po-detail-actions">{selected && selected.status === 'draft' && <><button className="primary-button" onClick={() => openMail(selected)}><Mail size={15}/>Send PO to supplier</button><button className="secondary-button" onClick={() => void copyMessage(selected)}><Copy size={15}/>{copied ? 'Copied' : 'Copy message'}</button></>}{selected && selected.status === 'ordered' && <><button className="primary-button" onClick={() => setConfirmReceive(selected)}>Mark received</button><button className="secondary-button" onClick={() => void copyMessage(selected)}><Copy size={15}/>{copied ? 'Copied' : 'Copy message'}</button></>}{selected?.status === 'draft' && <button className="po-receive-disabled" disabled title="Send the PO first.">Mark received</button>}</div></Can>
      </div>}</aside></div>}
    {confirmDiscard && <div className="po-confirm-backdrop" role="presentation"><section className="po-confirm" role="alertdialog" aria-modal="true" aria-labelledby="po-discard-title"><h3 id="po-discard-title">Discard this purchase order?</h3><p>Your unsaved supplier and item details will be lost.</p><footer><button className="secondary-button" onClick={() => setConfirmDiscard(false)}>Keep editing</button><button className="primary-button" onClick={() => { setConfirmDiscard(false); setDrawer(null) }}>Discard changes</button></footer></section></div>}
    {confirmSend && <div className="po-confirm-backdrop" role="presentation"><section className="po-confirm" role="alertdialog" aria-modal="true" aria-labelledby="po-send-title"><h3 id="po-send-title">Did you send the email?</h3><p>After sending the message to {confirmSend.supplier_name}, mark {poNumber(confirmSend)} as sent.</p><footer><button className="secondary-button" disabled={transitioningId !== null} onClick={() => setConfirmSend(null)}>Not yet</button><Can permission="purchase_orders:manage"><button className="primary-button" disabled={transitioningId !== null} onClick={() => void setOrderStatus(confirmSend, 'ordered')}>{transitioningId === confirmSend.purchase_order_id ? 'Saving…' : 'Yes, mark as sent'}</button></Can></footer></section></div>}
    {confirmReceive && <div className="po-confirm-backdrop" role="presentation"><section className="po-confirm" role="alertdialog" aria-modal="true" aria-labelledby="po-receive-title"><h3 id="po-receive-title">Mark {poNumber(confirmReceive)} as received?</h3><p>This doesn’t change stock. Add the stock on the <Link href={`/portal/${process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN ?? ''}/inventory`}>Inventory page</Link>.</p><footer><button className="secondary-button" disabled={transitioningId !== null} onClick={() => setConfirmReceive(null)}>Cancel</button><Can permission="purchase_orders:manage"><button className="primary-button" disabled={transitioningId !== null} onClick={() => void setOrderStatus(confirmReceive, 'received')}>{transitioningId === confirmReceive.purchase_order_id ? 'Saving…' : 'Mark received'}</button></Can></footer></section></div>}
    {toast && <div className="po-toast" role="status"><span>{toast}</span><button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={15}/></button></div>}
  </AdminShell>
}
