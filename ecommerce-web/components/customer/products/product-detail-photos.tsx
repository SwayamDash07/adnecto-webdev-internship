'use client'

import { useState } from 'react'
import { money } from '@/lib/formatters'
import type { Product } from '@/types/catalog'
import { cartStore } from '@/lib/cart-store'
import { showCartToast } from '@/components/shared/cart-toast'
import { useWishlist } from '@/lib/wishlist-store'
import { ProductVisual } from './product-visual'

export function ProductDetailPhotos({ product }: { product: Product }) {
  const [variant, setVariant] = useState(product.variants?.[0] ?? 'Standard')
  const [quantity, setQuantity] = useState(1)
  const { saved, toggle } = useWishlist()
  const selectedVariant = product.variantDetails?.find(item => item.name === variant)
  const currentPrice = selectedVariant?.price ?? product.price
  const currentStock = selectedVariant?.stock ?? product.stock
  return <div className="product-detail"><div className={`detail-art product-art ${product.color}`}><ProductVisual product={product} /></div><div className="detail-copy"><p className="eyebrow">{product.brand ?? product.category} · {product.productType?.replace('_', ' ') ?? 'simple'} · SKU {selectedVariant?.sku ?? product.sku ?? 'SKU-0001'}</p><h1>{product.name}</h1><div className="rating">★ {product.rating} <small>{product.reviews.toLocaleString('en-IN')} ratings and reviews</small></div><p className="detail-description">{product.description ?? 'A thoughtfully selected product for everyday use, with quality materials and reliable performance.'}</p><div className="detail-price">{money(currentPrice)} <del>{money(product.oldPrice)}</del><span>Inclusive of all taxes</span></div><div className="detail-field"><b>Availability</b><span className={currentStock ? 'in-stock' : 'low-stock'}>{currentStock ? `In stock, ${currentStock} units` : 'Out of stock'}</span></div><div className="detail-field"><b>Variant</b><div className="variant-row">{(product.variants ?? ['Standard']).map(item => <button className={variant === item ? 'selected' : ''} key={item} onClick={() => { setVariant(item); setQuantity(1) }}>{item}</button>)}</div></div>{(product.ingredients || product.weight || product.isOrganic || product.isVegetarian || product.isGlutenFree) && <div className="detail-meta"><span>{product.weight ? `${product.weight} ${product.productType === 'loose_weight' ? 'kg' : 'g'}` : 'Packaged product'}</span>{product.isOrganic && <span>Organic</span>}{product.isVegetarian && <span>Vegetarian</span>}{product.isGlutenFree && <span>Gluten-free</span>}</div>}<div className="detail-field"><b>Quantity</b><div className="quantity"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><span>{quantity}</span><button disabled={quantity >= currentStock} onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}>+</button></div></div><div className="detail-actions"><button className="primary-button" disabled={!currentStock} onClick={() => { cartStore.add({ ...product, price: currentPrice, stock: currentStock }, quantity, variant); showCartToast(`${quantity} ${product.name} added to cart`) }}>{currentStock ? 'Add to cart' : 'Out of stock'}</button><button className={`secondary-button ${saved.has(product.id) ? 'saved' : ''}`} onClick={() => void toggle(product)}>{saved.has(product.id) ? 'Saved' : 'Save for later'}</button></div><div className="detail-meta"><span>GST {product.gst ?? 5}%</span><span>HSN {product.hsn ?? '00000000'}</span><span>7-day returns</span></div></div></div>
}
