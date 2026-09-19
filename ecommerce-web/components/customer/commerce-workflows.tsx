'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { addresses, money, products } from '@/lib/data'
import { fetchCatalogCategories, fetchCatalogProducts } from '@/lib/catalog-client'
import { calculateCart, createDemoOrder, filterProducts, type CheckoutDraft } from '@/lib/services/commerce'
import type { Address, CartLine, Product } from '@/lib/types'
import { cartStore, useCart } from '@/lib/cart-store'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

type RazorpayOptions = { key: string; amount: number; currency: string; name: string; description: string; order_id: string; handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void; modal?: { ondismiss?: () => void } }
declare global { interface Window { Razorpay?: new (options: RazorpayOptions) => { open: () => void } } }

function loadRazorpay() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve()
    const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.onload = () => resolve(); script.onerror = () => reject(new Error('Unable to load Razorpay checkout.')); document.body.appendChild(script)
  })
}
import { showCartToast } from '@/components/shared/cart-toast'
import { useWishlist } from '@/lib/wishlist-store'

export function CatalogueBrowser() {
  const [productsFromDatabase, setProductsFromDatabase] = useState<Product[]>([])
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [sort, setSort] = useState<'relevance' | 'price-low' | 'price-high' | 'rating'>('relevance')
  const [rating, setRating] = useState(0)
  const [availability, setAvailability] = useState(false)
  useEffect(() => { void Promise.all([fetchCatalogProducts(), fetchCatalogCategories()]).then(([loadedProducts, loadedCategories]) => { setProductsFromDatabase(loadedProducts); setCategoryOptions(loadedCategories.map(item => item.name)) }) }, [])
  const matches = useMemo(() => filterProducts(productsFromDatabase, { query, category, brand, sort, rating, availability }), [productsFromDatabase, query, category, brand, sort, rating, availability])
  const brands = [...new Set(productsFromDatabase.map(product => product.brand).filter((brand): brand is string => Boolean(brand)))].sort()
  return <section className="catalog-browser"><div className="browser-toolbar"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name, brand, SKU or barcode" /><select value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categoryOptions.map(item => <option key={item}>{item}</option>)}</select><select value={brand} onChange={event => setBrand(event.target.value)}><option value="">All brands</option>{brands.map(item => <option key={item}>{item}</option>)}</select><select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="relevance">Relevance</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="rating">Top rated</option></select></div><div className="filter-row"><label>Minimum rating <select value={rating} onChange={event => setRating(Number(event.target.value))}><option value="0">Any rating</option><option value="4">4★ & above</option><option value="4.5">4.5★ & above</option></select></label><label><input type="checkbox" checked={availability} onChange={event => setAvailability(event.target.checked)} /> In stock only</label><span>{matches.length} products found</span></div><div className="product-grid">{matches.length ? matches.map(product => <CatalogProduct key={product.id} product={product} />) : <section className="panel placeholder"><h2>No products found</h2><p>Products will appear here after they are added to Supabase.</p></section>}</div></section>
}

function ProductVisual({ product }: { product: Product }) { return product.imageUrl ? <img className="product-photo" src={product.imageUrl} alt={product.name} /> : <span className="product-emoji">{product.emoji}</span> }
function WishlistHeart({ product }: { product: Product }) { const { saved, toggle } = useWishlist(); return <button className={`heart wishlist-button ${saved.has(product.id) ? 'saved' : ''}`} aria-label={saved.has(product.id) ? 'Remove from wishlist' : 'Save product'} onClick={event => { event.preventDefault(); void toggle(product) }}>{saved.has(product.id) ? '♥' : '♡'}</button> }
function CatalogProduct({ product }: { product: Product }) { return <article className="product-card"><Link href={('/customer/product/' + product.id) as never}><div className={`product-art ${product.color}`}><span className="product-badge">{product.badge}</span><ProductVisual product={product} /><WishlistHeart product={product} /></div></Link><div className="product-info"><div className="rating">★ {product.rating} <small>({product.reviews.toLocaleString('en-IN')})</small></div><h3>{product.name}</h3><p className="price">{money(product.price)} <del>{money(product.oldPrice)}</del></p><p className="delivery">Free delivery · Tomorrow</p><button className="add-button" disabled={!product.stock} onClick={() => cartStore.add(product) && showCartToast(`${product.name} added to cart`)}>{product.stock ? 'Add to cart' : 'Out of stock'}</button></div></article> }

export function ProductDetail({ product }: { product: Product }) {
  const [variant, setVariant] = useState(product.variants?.[0] ?? 'Standard')
  const [quantity, setQuantity] = useState(1)
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState('')
  return <div className="product-detail"><div className={`detail-art product-art ${product.color}`}><span className="product-emoji">{product.emoji}</span></div><div className="detail-copy"><p className="eyebrow">{product.brand ?? product.category} · SKU {product.sku ?? 'SKU-0001'}</p><h1>{product.name}</h1><div className="rating">★ {product.rating} <small>{product.reviews.toLocaleString('en-IN')} ratings and reviews</small></div><p className="detail-description">{product.description ?? 'A thoughtfully selected product for everyday use, with quality materials and reliable performance.'}</p><div className="detail-price">{money(product.price)} <del>{money(product.oldPrice)}</del><span>Inclusive of all taxes</span></div><div className="detail-field"><b>Availability</b><span className="in-stock">✓ In stock · {product.stock} units</span></div><div className="detail-field"><b>Variant</b><div className="variant-row">{(product.variants ?? ['Standard']).map(item => <button className={variant === item ? 'selected' : ''} key={item} onClick={() => setVariant(item)}>{item}</button>)}</div></div><div className="detail-field"><b>Quantity</b><div className="quantity"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><span>{quantity}</span><button onClick={() => setQuantity(quantity + 1)}>+</button></div></div><div className="detail-actions"><button className="primary-button" onClick={() => setMessage(`${quantity} ${product.name} added to cart`)}>Add to cart <span>→</span></button><button className="secondary-button" onClick={() => setSaved(!saved)}>{saved ? '♥ Saved' : '♡ Save for later'}</button></div>{message && <p className="success-message">✓ {message}</p>}<div className="detail-meta"><span>GST {product.gst ?? 5}%</span><span>HSN {product.hsn ?? '00000000'}</span><span>7-day returns</span><span>Delivery estimate tomorrow</span></div></div></div>
}

export function CheckoutFlow() {
  const [lines, setLines] = useState<CartLine[]>([{ product: products[0], quantity: 1, variant: 'Black' }, { product: products[7], quantity: 2, variant: 'Standard box' }])
  const [address, setAddress] = useState<Address>(addresses[0])
  const [slot, setSlot] = useState('Tomorrow, 10 AM - 12 PM')
  const [instructions, setInstructions] = useState('')
  const [coupon, setCoupon] = useState('')
  const [couponApplied, setCouponApplied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const summary = calculateCart(lines)
  const draft: CheckoutDraft = { address, slot, instructions, payment: 'Razorpay', contactless: true, substituteUnavailable: true, lines }
  return <div className="checkout-layout"><div className="checkout-main"><CheckoutSection title="1. Delivery address"><div className="address-grid">{addresses.map(item => <button className={`address-card ${address.id === item.id ? 'selected' : ''}`} onClick={() => setAddress(item)} key={item.id}><strong>{item.label}</strong><span>{item.recipient}</span><small>{item.line}, {item.city} {item.postalCode}</small><em>{address.id === item.id ? 'Selected' : 'Use this address'}</em></button>)}<button className="address-card add-address">+ Add new address<br /><small>Use map location or enter manually</small></button></div></CheckoutSection><CheckoutSection title="2. Delivery preferences"><div className="form-grid"><label>Preferred delivery slot<select value={slot} onChange={event => setSlot(event.target.value)}><option>Tomorrow, 10 AM - 12 PM</option><option>Tomorrow, 12 PM - 2 PM</option><option>Tomorrow, 6 PM - 8 PM</option></select></label><label>Delivery instructions<textarea value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="Gate code, floor, landmark or any special note" /></label></div></CheckoutSection><section className="checkout-section"><h2>3. Secure payment</h2><p>Continue to Razorpay to select and complete your payment securely.</p></section><button className="primary-button place-order" onClick={() => { void draft; setConfirmed(true) }}>Pay securely with Razorpay · {money(summary.total)}</button>{confirmed && <div className="success-panel"><span>✓</span><div><h3>Order placed successfully</h3><p>Your demo checkout is complete.</p><Link className="primary-button" href="/customer/orders">Track order</Link></div></div>}</div><aside className="checkout-summary"><p className="eyebrow">ORDER SUMMARY</p><h2>Your cart</h2>{lines.map(line => <div className="summary-line" key={line.product.id}><span>{line.product.emoji} {line.product.name}<small>{line.variant} × {line.quantity}</small></span><b>{money(line.product.price * line.quantity)}</b></div>)}<div className="coupon-box"><input value={coupon} onChange={event => setCoupon(event.target.value)} placeholder="Coupon code" /><button onClick={() => setCouponApplied(Boolean(coupon))}>Apply</button>{couponApplied && <small>Cartly10 applied · 10% off</small>}</div><div className="totals"><span>Subtotal <b>{money(summary.subtotal)}</b></span><span>Delivery <b>{summary.delivery ? money(summary.delivery) : 'Free'}</b></span><span>Packaging <b>{money(summary.packing)}</b></span><span>Discount <b className="in-stock">−{money(summary.discount)}</b></span><strong>Total <b>{money(summary.total)}</b></strong></div></aside></div>
}

export function ProductDetailConnected({ product }: { product: Product }) {
  const [variant, setVariant] = useState(product.variants?.[0] ?? 'Standard')
  const [quantity, setQuantity] = useState(1)
  const [saved, setSaved] = useState(false)
  return <div className="product-detail"><div className={`detail-art product-art ${product.color}`}><span className="product-emoji">{product.emoji}</span></div><div className="detail-copy"><p className="eyebrow">{product.brand ?? product.category} · SKU {product.sku ?? 'SKU-0001'}</p><h1>{product.name}</h1><div className="rating">★ {product.rating} <small>{product.reviews.toLocaleString('en-IN')} ratings and reviews</small></div><p className="detail-description">{product.description ?? 'A thoughtfully selected product for everyday use, with quality materials and reliable performance.'}</p><div className="detail-price">{money(product.price)} <del>{money(product.oldPrice)}</del><span>Inclusive of all taxes</span></div><div className="detail-field"><b>Availability</b><span className={product.stock ? 'in-stock' : 'low-stock'}>{product.stock ? `✓ In stock · ${product.stock} units` : 'Out of stock'}</span></div><div className="detail-field"><b>Variant</b><div className="variant-row">{(product.variants ?? ['Standard']).map(item => <button className={variant === item ? 'selected' : ''} key={item} onClick={() => setVariant(item)}>{item}</button>)}</div></div><div className="detail-field"><b>Quantity</b><div className="quantity"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><span>{quantity}</span><button disabled={quantity >= product.stock} onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}>+</button></div></div><div className="detail-actions"><button className="primary-button" disabled={!product.stock} onClick={() => { cartStore.add(product, quantity, variant); showCartToast(`${quantity} ${product.name} added to cart`) }}>{product.stock ? 'Add to cart →' : 'Out of stock'}</button><button className="secondary-button" onClick={() => setSaved(!saved)}>{saved ? '♥ Saved' : '♡ Save for later'}</button></div><div className="detail-meta"><span>GST {product.gst ?? 5}%</span><span>HSN {product.hsn ?? '00000000'}</span><span>7-day returns</span></div></div></div>
}

export function LiveCheckoutFlow() {
  const { lines, totalQuantity, clear, lineKey } = useCart()
  const [addressesFromDatabase, setAddressesFromDatabase] = useState<Array<{ id: number; label: string; line1: string; city: string; postal_code: string }>>([])
  const [addressId, setAddressId] = useState<number | null>(null)
  const [slot, setSlot] = useState('Tomorrow, 10 AM - 12 PM')
  const [deliverySlots, setDeliverySlots] = useState<Array<{ id: number; starts_at: string; ends_at: string; capacity: number }>>([])
  const [instructions, setInstructions] = useState('')
  const [coupon, setCoupon] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponMessage, setCouponMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [orderId, setOrderId] = useState<number | null>(null)
  const summary = calculateCart(lines)
  const checkoutTotal = Math.max(0, summary.total - couponDiscount)
  useEffect(() => { void (async () => { const client = createSupabaseBrowserClient(); if (!client) return; const { data } = await client.from('addresses').select('id,label,line1,city,postal_code').order('id'); const loaded = (data ?? []) as Array<{ id: number; label: string; line1: string; city: string; postal_code: string }>; setAddressesFromDatabase(loaded); setAddressId(loaded[0]?.id ?? null) })() }, [])
  useEffect(() => { void (async () => { const client = createSupabaseBrowserClient(); if (!client) return; const { data } = await client.from('delivery_slots').select('id,starts_at,ends_at,capacity').gte('starts_at', new Date().toISOString()).order('starts_at').limit(12); const loaded = (data ?? []) as Array<{ id: number; starts_at: string; ends_at: string; capacity: number }>; setDeliverySlots(loaded); if (loaded[0]) setSlot(`${new Date(loaded[0].starts_at).toLocaleString('en-IN')} · ${loaded[0].capacity} places`) })() }, [])
  useEffect(() => { const savedCoupon = localStorage.getItem('cartly_coupon_code'); if (savedCoupon) setCoupon(savedCoupon) }, [])
  async function placeOrder() {
    setBusy(true); setError('')
    const client = createSupabaseBrowserClient()
    if (!client) { setError('Supabase is not configured.'); setBusy(false); return }
    const { data: { user } } = await client.auth.getUser()
    if (!user) { setError('Please sign in before payment.'); setBusy(false); return }
    if (!addressId) { setError('Please add and select a delivery address before payment.'); setBusy(false); return }
    const resolvedItems: Array<{ product_id: number; quantity: number; substitute: boolean }> = []
    for (const line of lines) {
      let product: { id: number } | null = null
      if (line.product.sku) {
        const bySku = await client.from('products').select('id').eq('sku', line.product.sku).maybeSingle()
        product = bySku.data
      }
      if (!product) {
        const byName = await client.from('products').select('id').eq('name', line.product.name).maybeSingle()
        product = byName.data
      }
      if (!product) {
        const byId = await client.from('products').select('id').eq('id', line.product.id).maybeSingle()
        product = byId.data
      }
      if (!product) { setError(`Product not found in Supabase: ${line.product.name}`); setBusy(false); return }
      resolvedItems.push({ product_id: product.id, quantity: line.quantity, substitute: true })
    }
    const { data, error: rpcError } = await client.rpc('place_order', { p_address_id: addressId, p_items: resolvedItems, p_payment_method: 'Razorpay', p_delivery_slot: `${slot}${instructions ? ` · ${instructions}` : ''}`, p_coupon_code: coupon || null })
    if (rpcError) { setError(rpcError.message); setBusy(false); return }
    const createdOrderId = Number(data)
    try {
      const createResponse = await fetch('/api/payments/create-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: createdOrderId }) })
      const razorpayOrder = await createResponse.json() as { keyId?: string; razorpayOrderId?: string; amount?: number; currency?: string; error?: string }
      if (!createResponse.ok || !razorpayOrder.keyId || !razorpayOrder.razorpayOrderId) throw new Error(razorpayOrder.error || 'Payment setup failed.')
      await loadRazorpay()
      if (!window.Razorpay) throw new Error('Razorpay checkout is unavailable.')
      new window.Razorpay({ key: razorpayOrder.keyId, amount: razorpayOrder.amount ?? Math.round(checkoutTotal * 100), currency: razorpayOrder.currency ?? 'INR', name: 'Cartly Hypermarket', description: `Order #${createdOrderId}`, order_id: razorpayOrder.razorpayOrderId, handler: response => { void fetch('/api/payments/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: createdOrderId, ...response }) }).then(async verifyResponse => { if (!verifyResponse.ok) throw new Error(((await verifyResponse.json()) as { error?: string }).error || 'Payment verification failed.'); setOrderId(createdOrderId); clear(); setBusy(false) }).catch(async verificationError => { await client.rpc('customer_cancel_order', { p_order_id: createdOrderId }); setError(verificationError instanceof Error ? verificationError.message : 'Payment verification failed.'); setBusy(false) }) }, modal: { ondismiss: () => { void client.rpc('customer_cancel_order', { p_order_id: createdOrderId }); setError('Payment cancelled. Your order was cancelled and stock was restored.'); setBusy(false) } } }).open()
    } catch (paymentError) { await client.rpc('customer_cancel_order', { p_order_id: createdOrderId }); setError(paymentError instanceof Error ? paymentError.message : 'Payment could not be started.'); setBusy(false) }
  }
  async function applyCoupon() {
    setCouponMessage(''); setCouponDiscount(0)
    if (!coupon.trim()) { setCouponMessage('Enter a coupon code.'); return }
    const client = createSupabaseBrowserClient(); if (!client) return
    const { data, error: couponError } = await client.rpc('customer_validate_coupon', { p_code: coupon, p_subtotal: summary.subtotal })
    if (couponError) setCouponMessage(couponError.message)
    else { const result = (data?.[0] ?? data) as { valid: boolean; discount: number; message: string } | null; setCouponDiscount(result?.valid ? Number(result.discount) : 0); setCouponMessage(result?.message ?? 'Coupon could not be applied.') }
  }
  if (!lines.length && !orderId) return <section className="panel placeholder"><span>🛒</span><h2>Your cart is empty</h2><Link className="primary-button" href="/">Continue shopping</Link></section>
  if (orderId) return <div className="success-panel"><span>✓</span><div><h3>Order placed successfully</h3><p>Order #{orderId} was saved to Supabase and inventory was decremented atomically.</p><Link className="primary-button" href="/customer/orders">Track order</Link></div></div>
  return <div className="checkout-layout"><div className="checkout-main"><CheckoutSection title="1. Delivery address"><div className="address-grid">{addressesFromDatabase.map(address => <button className={`address-card ${addressId === address.id ? 'selected' : ''}`} onClick={() => setAddressId(address.id)} key={address.id}><strong>{address.label}</strong><span>{address.line1}</span><small>{address.city} {address.postal_code}</small><em>{addressId === address.id ? 'Selected' : 'Use this address'}</em></button>)}</div>{!addressesFromDatabase.length && <p className="low-stock">Add a delivery address from Your account before placing this order.</p>}</CheckoutSection><CheckoutSection title="2. Delivery preferences"><div className="form-grid"><label>Preferred delivery slot<select value={slot} onChange={event => setSlot(event.target.value)}>{deliverySlots.length ? deliverySlots.map(item => <option key={item.id}>{new Date(item.starts_at).toLocaleString('en-IN')} · {item.capacity} places</option>) : <><option>Tomorrow, 10 AM - 12 PM</option><option>Tomorrow, 12 PM - 2 PM</option><option>Tomorrow, 6 PM - 8 PM</option></>}</select></label><label>Delivery instructions<textarea value={instructions} onChange={event => setInstructions(event.target.value)} /></label></div></CheckoutSection><section className="checkout-section"><h2>3. Secure payment</h2><p>Continue to Razorpay to choose a supported payment method securely.</p></section>{error && <p className="low-stock">{error}</p>}<button className="primary-button place-order" disabled={busy || !totalQuantity} onClick={() => void placeOrder()}>{busy ? 'Opening Razorpay…' : `Pay securely with Razorpay · ${money(checkoutTotal)}`}</button></div><aside className="checkout-summary"><p className="eyebrow">ORDER SUMMARY</p><h2>Your cart</h2>{lines.map(line => <div className="summary-line" key={lineKey(line)}><span>{line.product.name}<small>{line.quantity} × {money(line.product.price)}</small></span><b>{money(line.product.price * line.quantity)}</b></div>)}<div className="coupon-box"><input value={coupon} onChange={event => { setCoupon(event.target.value); setCouponDiscount(0); setCouponMessage('') }} placeholder="Coupon code" /><button onClick={() => void applyCoupon()}>Apply</button>{couponMessage && <small className={couponDiscount ? 'in-stock' : 'low-stock'}>{couponMessage}</small>}</div><div className="totals"><span>Subtotal <b>{money(summary.subtotal)}</b></span><span>Delivery <b>{summary.delivery ? money(summary.delivery) : 'Free'}</b></span><span>Packaging <b>{money(summary.packing)}</b></span><span>Discount <b className="in-stock">−{money(summary.discount + couponDiscount)}</b></span><strong>Total <b>{money(checkoutTotal)}</b></strong></div></aside></div>
}

export function ProductDetailPhotos({ product }: { product: Product }) {
  const [variant, setVariant] = useState(product.variants?.[0] ?? 'Standard')
  const [quantity, setQuantity] = useState(1)
  const { saved, toggle } = useWishlist()
  return <div className="product-detail"><div className={`detail-art product-art ${product.color}`}><ProductVisual product={product} /></div><div className="detail-copy"><p className="eyebrow">{product.brand ?? product.category} · SKU {product.sku ?? 'SKU-0001'}</p><h1>{product.name}</h1><div className="rating">★ {product.rating} <small>{product.reviews.toLocaleString('en-IN')} ratings and reviews</small></div><p className="detail-description">{product.description ?? 'A thoughtfully selected product for everyday use, with quality materials and reliable performance.'}</p><div className="detail-price">{money(product.price)} <del>{money(product.oldPrice)}</del><span>Inclusive of all taxes</span></div><div className="detail-field"><b>Availability</b><span className={product.stock ? 'in-stock' : 'low-stock'}>{product.stock ? `In stock, ${product.stock} units` : 'Out of stock'}</span></div><div className="detail-field"><b>Variant</b><div className="variant-row">{(product.variants ?? ['Standard']).map(item => <button className={variant === item ? 'selected' : ''} key={item} onClick={() => setVariant(item)}>{item}</button>)}</div></div><div className="detail-field"><b>Quantity</b><div className="quantity"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><span>{quantity}</span><button disabled={quantity >= product.stock} onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}>+</button></div></div><div className="detail-actions"><button className="primary-button" disabled={!product.stock} onClick={() => { cartStore.add(product, quantity, variant); showCartToast(`${quantity} ${product.name} added to cart`) }}>{product.stock ? 'Add to cart' : 'Out of stock'}</button><button className={`secondary-button ${saved.has(product.id) ? 'saved' : ''}`} onClick={() => void toggle(product)}>{saved.has(product.id) ? 'Saved' : 'Save for later'}</button></div><div className="detail-meta"><span>GST {product.gst ?? 5}%</span><span>HSN {product.hsn ?? '00000000'}</span><span>7-day returns</span></div></div></div>
}

function CheckoutSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="checkout-section"><h2>{title}</h2>{children}</section> }
