'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, MoreHorizontal, Package, Pencil, Plus, RefreshCw, Search, X } from 'lucide-react'
import { AdminShell } from '../admin-shell'
import { ProductFormFields } from './product-form-fields'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/formatters'
import { useRealtimeReload } from '@/lib/use-realtime-reload'
import { emptyProduct } from '@/constants/admin-product'
import { categories } from '@/constants/categories'
import type { AdminProduct } from '@/types/admin'
import { useCan } from '@/lib/use-can'

const routeBase = process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN ? `/portal/${process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN}` : '/404'
const addHref = `${routeBase}/products/new`

export function LiveProductManager({ initialProducts, initialError, initialFilters }: { initialProducts: AdminProduct[]; initialError: string; initialFilters: Record<'search' | 'category' | 'status' | 'stock' | 'sort' | 'page', string> }) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const canCreate = useCan('products:create')
  const canDisable = useCan('products:disable')
  const [products, setProducts] = useState<AdminProduct[]>(initialProducts)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)
  const [query, setQuery] = useState(initialFilters.search)
  const [category, setCategory] = useState(initialFilters.category || 'all')
  const [status, setStatus] = useState(initialFilters.status || 'all')
  const [stock, setStock] = useState(initialFilters.stock || 'all')
  const [sort, setSort] = useState(initialFilters.sort || 'name')
  const [page, setPage] = useState(Math.max(1, Number(initialFilters.page) || 1))
  const [pageSize, setPageSize] = useState(10)
  const [menu, setMenu] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<AdminProduct | null>(null)
  const [savingToggle, setSavingToggle] = useState(false)
  const [editing, setEditing] = useState<AdminProduct | null>(null)
  const [form, setForm] = useState(emptyProduct)
  const [image, setImage] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (searchParams.get('created') !== '1') return
    setToast('Product created successfully.')
    window.history.replaceState(null, '', pathname)
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [pathname, searchParams])

  useEffect(() => {
    setProducts(initialProducts)
    setError(initialError)
    setLoading(false)
  }, [initialProducts, initialError])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href)
      const values = { search: query.trim(), category, status, stock, sort, page: page > 1 ? String(page) : '' }
      for (const [key, value] of Object.entries(values)) {
        if (!value || (key !== 'search' && key !== 'page' && value === ({ category: 'all', status: 'all', stock: 'all', sort: 'name' } as Record<string, string>)[key])) url.searchParams.delete(key)
        else url.searchParams.set(key, value)
      }
      startTransition(() => router.replace(url.pathname + url.search, { scroll: false }))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query, category, status, stock, sort, page, router])

  function load() { setLoading(true); startTransition(() => router.refresh()) }
  useRealtimeReload('admin-products-live', ['products', 'inventory'], load)

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    const list = products.filter(product => {
      const candidate = product as AdminProduct & { barcode?: string | null }
      return (!search || `${product.product_name} ${product.sku ?? ''} ${candidate.barcode ?? ''}`.toLowerCase().includes(search)) &&
        (category === 'all' || product.category_name === category) &&
        (status === 'all' || (status === 'active' ? product.is_active : !product.is_active)) &&
        (stock === 'all' || (stock === 'in' ? product.current_stock >= 20 : stock === 'low' ? product.current_stock > 0 && product.current_stock < 20 : product.current_stock <= 0))
    })
    return list.sort((a, b) => sort === 'price-low' ? Number(a.selling_price) - Number(b.selling_price) : sort === 'price-high' ? Number(b.selling_price) - Number(a.selling_price) : sort === 'stock-low' ? Number(a.current_stock) - Number(b.current_stock) : a.product_name.localeCompare(b.product_name))
  }, [products, query, category, status, stock, sort])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const isFiltered = Boolean(query || category !== 'all' || status !== 'all' || stock !== 'all')
  function clearFilters() { setQuery(''); setCategory('all'); setStatus('all'); setStock('all'); setPage(1) }
  function openEdit(product: AdminProduct) {
    setEditing(product)
    setForm({ ...emptyProduct, name: product.product_name, sku: product.sku ?? '', brand: product.brand_name ?? '', category: product.category_name ?? '', price: String(product.selling_price), mrp: String(product.mrp), stock: String(product.current_stock) })
    setImage(null)
  }
  async function saveEdit(event: React.FormEvent) {
    event.preventDefault()
    if (!editing) return
    if (image?.name.startsWith('__')) { setError(image.name === '__too_large__' ? 'Image must be smaller than 5 MB.' : 'Choose a PNG, JPG, or WebP image.'); return }
    setSaving(true); setError('')
    const client = createSupabaseBrowserClient()
    if (!client) { setSaving(false); return }
    const { data: productId, error: saveError } = await client.rpc('admin_upsert_product', {
      p_product_id: editing.product_id, p_name: form.name, p_sku: form.sku || null, p_barcode: form.barcode || null,
      p_brand: form.brand || null, p_category: form.category || null, p_description: form.description || null,
      p_selling_price: Number(form.price), p_mrp: Number(form.mrp || form.price), p_gst: Number(form.gst),
      p_hsn: form.hsn || null, p_stock: Number(form.stock)
    })
    if (saveError) { setError(saveError.message); setSaving(false); return }
    if (image && productId) {
      const path = `${productId}/${crypto.randomUUID()}-${image.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
      const { error: uploadError } = await client.storage.from('product-media').upload(path, image)
      if (uploadError) { setError(`Product saved, but image upload failed: ${uploadError.message}`); setSaving(false); return }
      const { data: publicUrl } = client.storage.from('product-media').getPublicUrl(path)
      const { error: imageError } = await client.rpc('admin_add_product_image', { p_product_id: productId, p_storage_path: publicUrl.publicUrl, p_alt_text: form.name })
      if (imageError) { setError(`Product saved, but image record failed: ${imageError.message}`); setSaving(false); return }
    }
    setEditing(null); setSaving(false); setToast('Product updated.'); window.setTimeout(() => setToast(''), 3200); await load()
  }
  async function toggle(product: AdminProduct) {
    setSavingToggle(true)
    const client = createSupabaseBrowserClient()
    if (!client) { setSavingToggle(false); return }
    const { error: toggleError } = await client.rpc('admin_toggle_product', { p_product_id: product.product_id, p_active: !product.is_active })
    setSavingToggle(false); setConfirm(null)
    if (toggleError) setError(toggleError.message)
    else { setToast(product.is_active ? 'Product disabled.' : 'Product enabled.'); window.setTimeout(() => setToast(''), 3200); await load() }
  }
  const stats = [
    { label: 'Total products', value: products.length },
    { label: 'Active', value: products.filter(item => item.is_active).length },
    { label: 'Low stock', value: products.filter(item => item.current_stock > 0 && item.current_stock < 20).length },
    { label: 'Out of stock', value: products.filter(item => item.current_stock <= 0).length }
  ]
  const filterControls = <div className="product-toolbar">
    <label className="product-search"><Search size={16} /><input value={query} placeholder="Search name, SKU, barcode" onChange={event => { setQuery(event.target.value); setPage(1) }} aria-label="Search products" />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button>}</label>
    <select aria-label="Filter by category" value={category} onChange={event => { setCategory(event.target.value); setPage(1) }}><option value="all">All categories</option>{Array.from(new Set([...categories, ...products.map(item => item.category_name).filter((value): value is string => Boolean(value))])).map(value => <option key={value}>{value}</option>)}</select>
    <select aria-label="Filter by status" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="all">All statuses</option><option value="active">Active</option><option value="disabled">Disabled</option></select>
    <select aria-label="Filter by stock" value={stock} onChange={event => { setStock(event.target.value); setPage(1) }}><option value="all">All stock</option><option value="in">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select>
    <select aria-label="Sort products" value={sort} onChange={event => setSort(event.target.value)}><option value="name">Name A–Z</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="stock-low">Stock: low to high</option></select>
  </div>
  function stockPill(product: AdminProduct) { return <span className={`product-stock-pill ${product.current_stock <= 0 ? 'out' : product.current_stock < 20 ? 'low' : 'in'}`}>{product.current_stock <= 0 ? 'Out' : product.current_stock < 20 ? 'Low' : 'In stock'}</span> }
  function statusPill(product: AdminProduct) { return <span className={`product-status ${product.is_active ? 'active' : 'disabled'}`}>{product.is_active ? 'Active' : 'Disabled'}</span> }

  return <AdminShell eyebrow="CATALOGUE" title="Products" description={`${products.length} products in your catalogue.`} action={canCreate ? <Link href={addHref} className="primary-button product-add-link"><Plus size={17} />Add product</Link> : undefined}>
    <section className="product-stats">{stats.map(stat => <div className="product-stat" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}</section>
    <section className="product-list-card">
      <div className="product-list-toolbar">{filterControls}<div className="product-results"><span>Showing {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} products</span>{isFiltered && <button type="button" onClick={clearFilters}>Clear filters</button>}<button type="button" className="product-refresh" onClick={() => void load()} aria-label="Refresh products"><RefreshCw size={15} /></button></div></div>
      {error && <div className="product-error" role="alert"><span>{error}</span><button type="button" className="secondary-button" onClick={() => void load()}>Retry</button></div>}
      {loading ? <div className="product-skeleton" aria-label="Loading products">{Array.from({ length: 6 }, (_, index) => <div key={index}><i /><span /><span /></div>)}</div> : !error && !products.length ? <div className="product-empty"><Package size={30} /><h2>No products yet</h2><p>Add your first product to start building your catalogue.</p>{canCreate&&<Link className="primary-button" href={addHref}><Plus size={16} />Add your first product</Link>}</div> : !error && !filtered.length ? <div className="product-empty"><Search size={28} /><h2>No products match your filters</h2><p>Try changing your search or clearing the selected filters.</p><button className="secondary-button" onClick={clearFilters}>Clear filters</button></div> : !error && <>
        <div className="product-table-wrap"><table className="product-table"><thead><tr><th>Product</th><th>Category</th><th>Brand</th><th className="numeric">Price</th><th>Stock</th><th>Status</th><th className="product-actions-heading">Actions</th></tr></thead><tbody>
          {visible.map(product => <tr key={product.product_id} className={!product.is_active ? 'is-disabled' : ''}>
            <td><div className="product-identity"><span className="product-thumb">{product.image_url ? <img src={product.image_url} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none' }} /> : <Package size={19} />}</span><span className="product-copy"><strong title={product.product_name}>{product.product_name}</strong><small>{product.sku || 'No SKU'}</small></span></div></td>
            <td>{product.category_name || 'Uncategorized'}</td><td>{product.brand_name || '—'}</td>
            <td className="numeric"><strong>{money(Number(product.selling_price))}</strong>{Number(product.mrp) > Number(product.selling_price) && <small className="product-mrp">{money(Number(product.mrp))}</small>}</td>
            <td><div className="product-stock-cell"><strong>{product.current_stock}</strong>{stockPill(product)}</div></td><td>{statusPill(product)}</td>
            <td><div className="product-actions"><button className="product-icon-button" type="button" aria-label={`Edit ${product.product_name}`} onClick={() => openEdit(product)}><Pencil size={16} /></button>{canDisable&&<div className="product-more-wrap"><button className="product-icon-button" type="button" aria-label={`More actions for ${product.product_name}`} aria-expanded={menu === product.product_id} onClick={() => setMenu(menu === product.product_id ? null : product.product_id)}><MoreHorizontal size={18} /></button>{menu === product.product_id && <><button className="product-menu-dismiss" aria-label="Close actions" onClick={() => setMenu(null)} /><div className="product-action-menu"><button type="button" onClick={() => { setMenu(null); if (product.is_active) setConfirm(product); else void toggle(product) }}><ChevronDown size={14} />{product.is_active ? 'Disable product' : 'Enable product'}</button></div></>}</div>}</div></td>
          </tr>)}
        </tbody></table></div>
        <div className="product-mobile-list">{visible.map(product => <article className={`product-mobile-card ${!product.is_active ? 'is-disabled' : ''}`} key={product.product_id}>
          <div className="product-mobile-top"><div className="product-identity"><span className="product-thumb">{product.image_url ? <img src={product.image_url} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none' }} /> : <Package size={19} />}</span><span className="product-copy"><strong>{product.product_name}</strong><small>{product.sku || 'No SKU'} · {product.category_name || 'Uncategorized'}</small></span></div>{statusPill(product)}</div>
          <div className="product-mobile-data"><span><small>Price</small><strong>{money(Number(product.selling_price))}</strong>{Number(product.mrp) > Number(product.selling_price) && <small className="product-mrp">{money(Number(product.mrp))}</small>}</span><span><small>Stock</small><strong>{product.current_stock} {stockPill(product)}</strong></span><span><small>Brand</small><strong>{product.brand_name || '—'}</strong></span></div>
          <div className="product-mobile-actions"><button className="secondary-button" onClick={() => openEdit(product)}><Pencil size={14} />Edit</button>{canDisable&&<button className="secondary-button" onClick={() => product.is_active ? setConfirm(product) : void toggle(product)}>{product.is_active ? 'Disable' : 'Enable'}</button>}</div>
        </article>)}</div>
        <div className="product-pagination"><label>Rows per page<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label><span>Page {page} of {totalPages}</span><div><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><button disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>Next</button></div></div>
      </>}
    </section>
    {confirm && <div className="product-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setConfirm(null) }}><section className="product-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="product-disable-title"><h2 id="product-disable-title">Disable this product?</h2><p>{confirm.product_name} will no longer be available as an active product. You can enable it again later.</p><div><button className="secondary-button" onClick={() => setConfirm(null)}>Cancel</button><button className="product-danger-button" disabled={savingToggle} onClick={() => void toggle(confirm)}>{savingToggle ? 'Disabling…' : 'Disable product'}</button></div></section></div>}
    {editing && <div className="product-modal-backdrop product-edit-backdrop"><form className="product-edit-dialog" onSubmit={event => void saveEdit(event)}><div className="product-edit-heading"><div><p className="eyebrow">CATALOGUE</p><h2>Edit product</h2></div><button type="button" className="product-icon-button" aria-label="Close edit form" onClick={() => setEditing(null)}><X size={18} /></button></div><ProductFormFields form={form} update={(key, value) => setForm(current => ({ ...current, [key]: value }))} image={image} setImage={setImage} readOnlyPricing={!canCreate} />{error && <div className="product-error" role="alert">{error}</div>}<div className="product-edit-footer"><button type="button" className="secondary-button" onClick={() => setEditing(null)} disabled={saving}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Update product'}</button></div></form></div>}
    {toast && <div className="product-toast" role="status">{toast}</div>}
  </AdminShell>
}
