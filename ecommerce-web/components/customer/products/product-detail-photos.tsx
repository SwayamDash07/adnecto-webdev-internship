'use client'

import { useState } from 'react'
import { money } from '@/lib/formatters'
import type { Product } from '@/types/catalog'
import { useWishlist } from '@/lib/wishlist-store'
import { ProductVisual } from './product-visual'
import { CartAddControl } from '@/components/shared/cart-add-control'

export function ProductDetailPhotos({ product }: { product: Product }) {
  const [variant, setVariant] = useState(product.variants?.[0] ?? 'Standard')
  const { saved, toggle } = useWishlist()
  const selectedVariant = product.variantDetails?.find(item => item.name === variant)
  const currentPrice = selectedVariant?.price ?? product.price
  const currentStock = selectedVariant?.stock ?? product.stock
  return <div className="product-detail"><div className={`detail-art product-art ${product.color}`}><ProductVisual product={product} /></div><div className="detail-copy"><p className="eyebrow">{product.brand ?? product.category} · {product.productType?.replace('_', ' ') ?? 'simple'} · SKU {selectedVariant?.sku ?? product.sku ?? 'SKU-0001'}</p><h1>{product.name}</h1><div className="rating">★ {product.rating} <small>{product.reviews.toLocaleString('en-IN')} ratings and reviews</small></div><p className="detail-description">{product.description ?? 'A thoughtfully selected product for everyday use, with quality materials and reliable performance.'}</p><div className="detail-price">{money(currentPrice)} <del>{money(product.oldPrice)}</del><span>Inclusive of all taxes</span></div><div className="detail-field"><b>Availability</b><span className={currentStock ? 'in-stock' : 'low-stock'}>{currentStock ? `In stock, ${currentStock} units` : 'Out of stock'}</span></div><div className="detail-field"><b>Variant</b><div className="variant-row">{(product.variants ?? ['Standard']).map(item => <button className={variant === item ? 'selected' : ''} key={item} onClick={() => setVariant(item)}>{item}</button>)}</div></div>{(product.ingredients || product.weight || product.isOrganic || product.isVegetarian || product.isGlutenFree) && <div className="detail-meta"><span>{product.weight ? `${product.weight} ${product.productType === 'loose_weight' ? 'kg' : 'g'}` : 'Packaged product'}</span>{product.isOrganic && <span>Organic</span>}{product.isVegetarian && <span>Vegetarian</span>}{product.isGlutenFree && <span>Gluten-free</span>}</div>}<div className="detail-actions"><CartAddControl product={{ ...product, price: currentPrice, stock: currentStock, stockIsAvailabilityOnly: false }} variant={variant} /><button className={`secondary-button ${saved.has(product.id) ? 'saved' : ''}`} onClick={() => void toggle(product)}>{saved.has(product.id) ? 'Saved' : 'Save for later'}</button></div><div className="detail-meta"><span>GST {product.gst ?? 5}%</span><span>HSN {product.hsn ?? '00000000'}</span><span>7-day returns</span></div></div></div>
}
