'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminShell } from '../admin-shell'
import { type InventoryAdjustment } from '@/lib/services/admin'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRealtimeReload } from '@/lib/use-realtime-reload'
import { Can } from '@/lib/use-can'
import { ArrowDownRight, ArrowUpRight, RefreshCw, Search, X } from 'lucide-react'

type InventoryItem = { product_id: number; product_name: string; sku: string | null; current_stock: number; reserved_stock: number; reorder_level: number }
type AdjustmentLogRow = { adjustment_id: number; created_at: string; product_name: string; sku: string | null; warehouse: string; quantity_change: number; reason: string; done_by: string }
type StateFilter = 'all' | 'healthy' | 'low' | 'out'
type InventoryTab = 'Stock' | 'Adjustment log'
const PAGE_SIZE = 20

function logInventoryError(area: string, error: unknown) {
  console.error(`[Inventory] ${area} failed`, error)
}

function isPermissionError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '42501')
}

const available = (item: InventoryItem) => Math.max(0, item.current_stock - item.reserved_stock)
const stateOf = (item: InventoryItem): StateFilter => available(item) <= 0 ? 'out' : available(item) <= item.reorder_level ? 'low' : 'healthy'

export function InventoryManager() {
  const [pageSize, setPageSize] = useState(10)
  const [tab, setTab] = useState<InventoryTab>('Stock')
  const [stockFilter, setStockFilter] = useState(false)
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'attention' | 'name' | 'available'>('attention')
  const [page, setPage] = useState(1)
  const [adjustment, setAdjustment] = useState<InventoryAdjustment>({ product: '', warehouse: 'Mumbai Central', quantity: '', reason: 'Stock correction' })
  const [otherNote, setOtherNote] = useState('')
  const [direction, setDirection] = useState<'add' | 'remove'>('add')
  const [items, setItems] = useState<InventoryItem[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [adjustmentLog, setAdjustmentLog] = useState<AdjustmentLogRow[]>([])
  const [logSearchDraft, setLogSearchDraft] = useState('')
  const [logSearch, setLogSearch] = useState('')
  const [logError, setLogError] = useState('')
  const [logLoading, setLogLoading] = useState(true)
  const [logLoadingMore, setLogLoadingMore] = useState(false)
  const [logHasMore, setLogHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmLarge, setConfirmLarge] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    const client = createSupabaseBrowserClient()
    if (!client) { setLoading(false); setError('Inventory service is unavailable.'); return }
    setLoading(true)
    try {
      const { data, error: queryError } = await client.rpc('admin_list_inventory')
      if (queryError) { logInventoryError('admin_list_inventory', queryError); setError('We could not load inventory. Please try again.') }
      else { setError(''); setItems((data ?? []) as InventoryItem[]); setLastUpdated(new Date()) }
    } catch (error) { logInventoryError('admin_list_inventory', error); setError('We could not load inventory. Please try again.') }
    finally { setLoading(false) }
  }, [])

  const loadAdjustmentLog = useCallback(async (offset = 0, append = false, search = logSearch) => {
    const client = createSupabaseBrowserClient()
    if (!client) { setLogError('The adjustment log is unavailable. Please try again.'); setLogLoading(false); setLogLoadingMore(false); return }
    setLogError('')
    if (append) setLogLoadingMore(true)
    else setLogLoading(true)
    try {
      const { data, error: queryError } = await client.rpc('admin_list_inventory_adjustments', { p_limit: PAGE_SIZE, p_offset: offset, p_search: search || null })
      if (queryError) {
        logInventoryError('admin_list_inventory_adjustments', queryError)
        setLogError(isPermissionError(queryError) ? 'You do not have permission to view the adjustment log.' : 'We could not load the adjustment log. Please try again.')
      } else {
        const rows = (data ?? []) as AdjustmentLogRow[]
        setAdjustmentLog(current => append ? [...current, ...rows] : rows)
        setLogHasMore(rows.length === PAGE_SIZE)
      }
    } catch (error) { logInventoryError('admin_list_inventory_adjustments', error); setLogError(isPermissionError(error) ? 'You do not have permission to view the adjustment log.' : 'We could not load the adjustment log. Please try again.') }
    finally { setLogLoading(false); setLogLoadingMore(false) }
  }, [logSearch])

  useEffect(() => { setStockFilter(new URLSearchParams(window.location.search).get('stock') === 'low'); void load() }, [load])
  useEffect(() => { void loadAdjustmentLog() }, [loadAdjustmentLog])
  useEffect(() => { const timer = window.setTimeout(() => setLogSearch(logSearchDraft.trim()), 300); return () => window.clearTimeout(timer) }, [logSearchDraft])
  useRealtimeReload('admin-inventory-live', ['inventory', 'products', 'inventory_movements'], () => { void load(); void loadAdjustmentLog(0, false, logSearch) })

  const counts = useMemo(() => ({
    all: items.length,
    healthy: items.filter(item => stateOf(item) === 'healthy').length,
    low: items.filter(item => stateOf(item) === 'low').length,
    out: items.filter(item => stateOf(item) === 'out').length,
  }), [items])
  const visibleItems = useMemo(() => {
    let filtered = items.filter(item => {
      const matchesQuery = `${item.product_name} ${item.sku ?? ''}`.toLowerCase().includes(query.toLowerCase().trim())
      const state = stateOf(item)
      return matchesQuery && (stateFilter === 'all' || state === stateFilter) && (!stockFilter || state !== 'healthy')
    })
    filtered = [...filtered].sort((a, b) => sort === 'name' ? a.product_name.localeCompare(b.product_name) : sort === 'available' ? available(a) - available(b) : (stateOf(a) === 'out' ? 0 : stateOf(a) === 'low' ? 1 : 2) - (stateOf(b) === 'out' ? 0 : stateOf(b) === 'low' ? 1 : 2) || available(a) - available(b))
    return filtered
  }, [items, query, stateFilter, stockFilter, sort])
  const pageCount = Math.max(1, Math.ceil(visibleItems.length / pageSize))
  const pageItems = visibleItems.slice((page - 1) * pageSize, page * pageSize)
  const selectedProduct = items.find(item => item.product_name === adjustment.product)
  const requestedQuantity = Number(adjustment.quantity || 0)
  const delta = direction === 'add' ? requestedQuantity : -requestedQuantity
  const resultingStock = selectedProduct ? selectedProduct.current_stock + delta : null
  const isLargeChange = Boolean(selectedProduct && requestedQuantity && (requestedQuantity > 20 || requestedQuantity / Math.max(1, selectedProduct.current_stock) > 0.2))

  function selectState(next: StateFilter) { setStateFilter(next); setStockFilter(false); setPage(1) }
  function startAdjust(item: InventoryItem) {
    setAdjustment(current => ({ ...current, product: item.product_name }))
    setTab('Stock')
    document.getElementById('inventory-adjustment-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  async function saveAdjustment(skipConfirmation = false) {
    setError(''); setMessage('')
    const item = items.find(entry => entry.product_name === adjustment.product)
    const quantity = Number(adjustment.quantity)
    if (!item || !Number.isInteger(quantity) || quantity <= 0) { setError('Choose a product and enter a positive whole-number quantity.'); return }
    if (adjustment.reason === 'Other' && !otherNote.trim()) { setError('Add a note when the adjustment reason is Other.'); return }
    if (direction === 'remove' && quantity > available(item)) { setError(`Only ${available(item)} units are available; ${item.reserved_stock} units are reserved.`); return }
    if (isLargeChange && !skipConfirmation) { setConfirmLarge(true); return }
    setSaving(true)
    const client = createSupabaseBrowserClient()
    if (!client) { setError('The inventory service is unavailable. Please try again.'); setSaving(false); return }
    try {
      const { error: updateError } = await client.rpc('admin_adjust_inventory_with_batch', { p_product_id: item.product_id, p_delta: delta, p_reason: adjustment.reason === 'Other' ? `Other: ${otherNote.trim()}` : adjustment.reason, p_batch_number: null, p_expiry_date: null })
      if (updateError) { logInventoryError('admin_adjust_inventory_with_batch', updateError); setError('We could not save this stock adjustment. Please try again.') }
      else { setMessage('Inventory updated successfully.'); setAdjustment(current => ({ ...current, quantity: '' })); setOtherNote(''); setConfirmLarge(false); await Promise.all([load(), loadAdjustmentLog(0, false, logSearch)]) }
    } catch (error) { logInventoryError('admin_adjust_inventory_with_batch', error); setError('We could not save this stock adjustment. Please try again.') }
    finally { setSaving(false) }
  }

  return <AdminShell title="Inventory controls" description="Review stock levels and record adjustments.">
    <div className="inv-page">
      <section className="inv-stats" aria-label="Inventory summary">
        <button className={stateFilter === 'all' ? 'selected' : ''} onClick={() => selectState('all')}><span>Total SKUs</span><strong>{loading ? '—' : counts.all}</strong></button>
        <button className={stateFilter === 'healthy' ? 'selected' : ''} onClick={() => selectState('healthy')}><span>Healthy</span><strong>{loading ? '—' : counts.healthy}</strong></button>
        <button className={stateFilter === 'low' ? 'selected' : ''} onClick={() => selectState('low')}><span>Low stock</span><strong>{loading ? '—' : counts.low}</strong></button>
        <button className={stateFilter === 'out' ? 'selected' : ''} onClick={() => selectState('out')}><span>Out of stock</span><strong>{loading ? '—' : counts.out}</strong></button>
      </section>
      <nav className="inv-tabs" role="tablist" aria-label="Inventory sections"><button type="button" role="tab" aria-selected={tab === 'Stock'} className={tab === 'Stock' ? 'active' : ''} onClick={() => setTab('Stock')}>Stock</button><button type="button" role="tab" aria-selected={tab === 'Adjustment log'} className={tab === 'Adjustment log' ? 'active' : ''} onClick={() => setTab('Adjustment log')}>Adjustment log</button></nav>

      {tab === 'Stock' ? <div className="inv-stock-layout">
        <Can permission="inventory:adjust" fallback={<section className="panel inv-form-card inv-readonly"><span className="inv-readonly-mark">Read only</span><h3>Stock adjustment</h3><p>Your role can view inventory but cannot change stock.</p></section>}>
          <section className="panel inv-form-card" id="inventory-adjustment-form">
            <div className="inv-section-title"><div><h3>Stock adjustment</h3><p>Every change is recorded in the inventory audit.</p></div></div>
            <div className="inv-form-fields">
              <label className="inv-field inv-field-wide">Product
                <input list="inv-product-options" value={adjustment.product} onChange={event => setAdjustment({ ...adjustment, product: event.target.value })} placeholder="Search by product or SKU" autoComplete="off" />
                <datalist id="inv-product-options">{items.map(item => <option key={item.product_id} value={item.product_name}>{item.sku || 'No SKU'} · {item.current_stock} in stock</option>)}</datalist>
                {selectedProduct && <small>SKU {selectedProduct.sku || '—'} · {selectedProduct.current_stock} on hand · {selectedProduct.reserved_stock} reserved</small>}
              </label>
              <label className="inv-field">Warehouse<select value={adjustment.warehouse} onChange={event => setAdjustment({ ...adjustment, warehouse: event.target.value })}><option>Mumbai Central</option><option>Bengaluru South</option><option>Delhi NCR</option></select></label>
              <fieldset className="inv-direction"><legend>Adjustment</legend><div><button type="button" className={direction === 'add' ? 'active' : ''} onClick={() => setDirection('add')}>Add</button><button type="button" className={direction === 'remove' ? 'active' : ''} onClick={() => setDirection('remove')}>Remove</button></div></fieldset>
              <label className="inv-field">Quantity <div className="inv-quantity"><button type="button" aria-label="Decrease quantity" onClick={() => setAdjustment(current => ({ ...current, quantity: String(Math.max(1, Number(current.quantity || 1) - 1)) }))}>−</button><input type="number" min="1" step="1" value={adjustment.quantity} onChange={event => setAdjustment({ ...adjustment, quantity: event.target.value })} placeholder="0" /><button type="button" aria-label="Increase quantity" onClick={() => setAdjustment(current => ({ ...current, quantity: String(Number(current.quantity || 0) + 1) }))}>+</button></div>{selectedProduct && <small className="inv-preview">Current {selectedProduct.current_stock} <b>→</b> New {Math.max(0, resultingStock ?? selectedProduct.current_stock)}</small>}</label>
              <label className="inv-field">Reason<select value={adjustment.reason} onChange={event => setAdjustment({ ...adjustment, reason: event.target.value })}><option>Stock correction</option><option>Damaged</option><option>Expired</option><option>Returned</option><option>Received</option><option>Other</option><option>Wastage</option><option>Damaged goods</option><option>Stock transfer</option></select></label>
              {adjustment.reason === 'Other' && <label className="inv-field inv-field-wide">Note<input value={otherNote} onChange={event => setOtherNote(event.target.value)} placeholder="Add a reason for this adjustment" required /></label>}
            </div>
            <div className="inv-form-actions"><button className="secondary-button" type="button" onClick={() => { setError(''); setMessage(''); setOtherNote(''); setAdjustment({ product: '', warehouse: 'Mumbai Central', quantity: '', reason: 'Stock correction' }); setDirection('add') }}>Clear</button><button className="primary-button" type="button" disabled={saving} onClick={() => void saveAdjustment()}>{saving ? 'Saving…' : 'Save adjustment'}</button></div>
            {error && <p className="inv-feedback error" role="alert">{error}</p>}{message && <p className="inv-feedback success" role="status">{message}</p>}
          </section>
        </Can>
        <InventoryTable loading={loading} error={error} items={pageItems} total={visibleItems.length} page={page} pageCount={pageCount} pageSize={pageSize} setPageSize={value => { setPageSize(value); setPage(1) }} query={query} setQuery={value => { setQuery(value); setPage(1) }} sort={sort} setSort={value => { setSort(value); setPage(1) }} stateFilter={stateFilter} setStateFilter={selectState} lastUpdated={lastUpdated} onRefresh={() => void load()} onRetry={() => void load()} onAdjust={startAdjust} onPage={setPage} />
      </div> : <AdjustmentLog rows={adjustmentLog} loading={logLoading} loadingMore={logLoadingMore} hasMore={logHasMore} error={logError} search={logSearchDraft} onSearchChange={setLogSearchDraft} onRetry={() => void loadAdjustmentLog(0, false, logSearch)} onLoadMore={() => void loadAdjustmentLog(adjustmentLog.length, true, logSearch)} />}

      {confirmLarge && <div className="inv-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setConfirmLarge(false) }}><section className="inv-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="inv-confirm-title"><h3 id="inv-confirm-title">Confirm large adjustment</h3><p>You’re about to {direction} <strong>{requestedQuantity}</strong> units of <strong>{selectedProduct?.product_name}</strong>.</p><div className="inv-confirm-summary"><span>Current stock <b>{selectedProduct?.current_stock}</b></span><span>New stock <b>{resultingStock}</b></span><span>Reason <b>{adjustment.reason}</b></span></div><div className="inv-form-actions"><button className="secondary-button" onClick={() => setConfirmLarge(false)}>Cancel</button><button className="primary-button" disabled={saving} onClick={() => void saveAdjustment(true)}>{saving ? 'Saving…' : 'Confirm adjustment'}</button></div></section></div>}
    </div>
  </AdminShell>
}

function InventoryTable({ loading, error, items, total, page, pageCount, pageSize, setPageSize, query, setQuery, sort, setSort, stateFilter, setStateFilter, lastUpdated, onRefresh, onRetry, onAdjust, onPage }: {
  loading: boolean; error: string; items: InventoryItem[]; total: number; page: number; pageCount: number; pageSize: number; setPageSize: (value: number) => void; query: string; setQuery: (value: string) => void; sort: 'attention' | 'name' | 'available'; setSort: (value: 'attention' | 'name' | 'available') => void; stateFilter: StateFilter; setStateFilter: (value: StateFilter) => void; lastUpdated: Date | null; onRefresh: () => void; onRetry: () => void; onAdjust: (item: InventoryItem) => void; onPage: (value: number) => void
}) {
  return <section className="panel inv-table-card"><div className="inv-table-heading"><div><h3>Live inventory</h3><p>Showing {total} {total === 1 ? 'product' : 'products'}{lastUpdated ? ` · Updated ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}</p></div><button className="secondary-button" onClick={onRefresh} aria-label="Refresh inventory">↻ <span>Refresh</span></button></div>
    {error && <div className="inv-error" role="alert"><span>{error}</span><button className="secondary-button" onClick={onRetry}>Retry</button></div>}
    <div className="inv-toolbar"><label className="inv-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search product or SKU" aria-label="Search products by name or SKU" /></label><select value={stateFilter} onChange={event => setStateFilter(event.target.value as StateFilter)} aria-label="Filter by stock state"><option value="all">All states</option><option value="healthy">Healthy</option><option value="low">Low stock</option><option value="out">Out of stock</option></select><select value={sort} onChange={event => setSort(event.target.value as typeof sort)} aria-label="Sort inventory"><option value="attention">Needs attention first</option><option value="name">Product name</option><option value="available">Available stock</option></select></div>
    {loading ? <div className="inv-skeleton" aria-label="Loading inventory">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div> : items.length ? <><div className="inv-table-scroll"><table className="inv-table"><thead><tr><th>Product</th><th>SKU</th><th>Warehouse</th><th>Available</th><th>Reserved</th><th>Reorder level</th><th>Stock level</th><th>State</th><th>Actions</th></tr></thead><tbody>{items.map(item => { const state = stateOf(item); const count = available(item); return <tr key={item.product_id}><td className="inv-product-cell"><span className="inv-thumb" aria-hidden="true">{item.product_name.slice(0, 1).toUpperCase()}</span><strong title={item.product_name}>{item.product_name}</strong></td><td className="inv-sku">{item.sku || '—'}</td><td className="inv-muted">—</td><td className="inv-number">{count}</td><td className="inv-number">{item.reserved_stock}</td><td className="inv-number">{item.reorder_level}</td><td><div className={`inv-progress ${state}`} role="img" aria-label={`${count} available compared with reorder level ${item.reorder_level}`}><i style={{ width: `${Math.min(100, item.reorder_level > 0 ? count / item.reorder_level * 100 : count > 0 ? 100 : 0)}%` }} /></div></td><td><span className={`inv-state ${state}`}><i />{state === 'out' ? 'Out of stock' : state === 'low' ? 'Low stock' : 'Healthy'}</span></td><td><Can permission="inventory:adjust"><button className="inv-adjust-button" onClick={() => onAdjust(item)}>Adjust</button></Can></td></tr> })}</tbody></table></div><div className="inv-mobile-cards">{items.map(item => { const state = stateOf(item); return <article key={item.product_id} className="inv-mobile-item"><div className="inv-mobile-top"><strong>{item.product_name}</strong><span className={`inv-state ${state}`}><i />{state === 'out' ? 'Out of stock' : state === 'low' ? 'Low stock' : 'Healthy'}</span></div><small className="inv-sku">{item.sku || 'No SKU'}</small><dl><div><dt>Available</dt><dd>{available(item)}</dd></div><div><dt>Reserved</dt><dd>{item.reserved_stock}</dd></div><div><dt>Reorder level</dt><dd>{item.reorder_level}</dd></div></dl><Can permission="inventory:adjust"><button className="inv-adjust-button" onClick={() => onAdjust(item)}>Adjust stock</button></Can></article> })}</div><div className="inv-pagination"><span>{total ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}` : 'No products'}</span><label>Rows <select value={pageSize} onChange={event => setPageSize(Number(event.target.value))} aria-label="Rows per page"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><div><button disabled={page <= 1} onClick={() => onPage(page - 1)}>← Previous</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount} onClick={() => onPage(page + 1)}>Next →</button></div></div></> : <div className="inv-empty"><span>⌕</span><strong>{error ? 'Inventory could not be loaded' : 'No products match your filters'}</strong><p>{error ? 'Check your connection, then try again.' : 'Try another search or clear the current filters.'}</p><button className="secondary-button" onClick={error ? onRetry : () => { setQuery(''); setStateFilter('all') }}>{error ? 'Retry' : 'Clear filters'}</button></div>}
  </section>
}

function AdjustmentLog({ rows, loading, loadingMore, hasMore, error, search, onSearchChange, onRetry, onLoadMore }: {
  rows: AdjustmentLogRow[]; loading: boolean; loadingMore: boolean; hasMore: boolean; error: string; search: string; onSearchChange: (value: string) => void; onRetry: () => void; onLoadMore: () => void
}) {
  const warehouseCount = new Set(rows.map(row => (row.warehouse || 'default').toLowerCase())).size
  const showWarehouse = warehouseCount > 1 || hasMore
  const shownCount = hasMore ? `${rows.length}+` : String(rows.length)
  const displayName = (value: string) => value.includes('@') ? value.split('@')[0] : value
  const initials = (value: string) => displayName(value).trim().split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?'
  const titleCase = (value: string) => value.replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase())

  return <section className="panel adj-card">
    <header className="adj-heading"><div><h3>Adjustment log</h3><p>Stock corrections, newest first.</p></div><button className="adj-refresh" type="button" aria-label="Refresh log" title="Refresh log" onClick={onRetry}><RefreshCw size={17} aria-hidden="true" /></button></header>
    <div className="adj-toolbar"><label className="adj-search"><Search size={18} aria-hidden="true" /><input value={search} onChange={event => onSearchChange(event.target.value)} placeholder="Search product, SKU or reason" aria-label="Search adjustments" />{search && <button type="button" className="adj-clear" aria-label="Clear search" onClick={() => onSearchChange('')}><X size={16} aria-hidden="true" /></button>}</label></div>
    {error && <div className="inv-error adj-error" role="alert"><span>{error}</span><button className="secondary-button" type="button" onClick={onRetry}>Retry</button></div>}
    {loading ? <div className="adj-scroll adj-skeleton" aria-label="Loading adjustment log">{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div> : rows.length ? <>
      <div className="adj-scroll"><table className="adj-table"><colgroup><col className="adj-col-date" /><col className="adj-col-product" />{showWarehouse && <col className="adj-col-warehouse" />}<col className="adj-col-change" /><col className="adj-col-reason" /><col className="adj-col-staff" /></colgroup><thead><tr><th>Date</th><th>Product</th>{showWarehouse && <th>Warehouse</th>}<th className="adj-num">Change</th><th>Reason</th><th>Done by</th></tr></thead><tbody>{rows.map(row => { const positive = row.quantity_change > 0; const ChangeIcon = positive ? ArrowUpRight : ArrowDownRight; const warehouse = row.warehouse.toLowerCase() === 'default' ? 'Default warehouse' : titleCase(row.warehouse); const name = displayName(row.done_by); return <tr key={row.adjustment_id}>
        <td data-label="Date"><time dateTime={row.created_at}><strong>{new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong><small>{new Date(row.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</small></time></td>
        <td className="adj-product" data-label="Product"><strong title={row.product_name}>{row.product_name}</strong><small>{row.sku || 'No SKU'}</small></td>
        {showWarehouse && <td data-label="Warehouse">{warehouse}</td>}
        <td className="adj-num" data-label="Change"><span className={`adj-pill ${positive ? 'adj-pill--pos' : 'adj-pill--neg'}`}><ChangeIcon size={15} aria-hidden="true" />{positive ? '+' : ''}{row.quantity_change}</span></td>
        <td data-label="Reason"><span className="adj-chip">{titleCase(row.reason || 'Stock adjustment')}</span></td>
        <td data-label="Done by"><span className="adj-person"><i aria-hidden="true">{initials(name)}</i><span>{name}</span></span></td>
      </tr>})}</tbody></table></div>
      <footer className="adj-footer"><span>Showing {hasMore ? `${rows.length} adjustments loaded so far` : `${rows.length} of ${rows.length} adjustments`}</span>{hasMore && <button className="secondary-button" type="button" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? 'Loading…' : 'Load more'}</button>}</footer>
    </> : !error && <div className="adj-scroll adj-empty"><span aria-hidden="true">↗</span><strong>No adjustments yet.</strong><p>Stock changes you make will appear here.</p></div>}
  </section>
}