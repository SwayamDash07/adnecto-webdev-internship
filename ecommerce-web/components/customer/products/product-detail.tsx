'use client'

import { useState } from 'react'
import { money } from '@/lib/formatters'
import type { Product } from '@/types/catalog'

export function ProductDetail({ product }: { product: Product }) {
  const [variant, setVariant] = useState(product.variants?.[0] ?? 'Standard')
  const [quantity, setQuantity] = useState(1)
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState('')
  return <div className="product-detail"><div className={`detail-art product-art ${product.color}`}><span className="product-emoji">{product.emoji}</span></div><div className="detail-copy"><p className="eyebrow">{product.brand ?? product.category} · SKU {product.sku ?? 'SKU-0001'}</p><h1>{product.name}</h1><div className="rating">★ {product.rating} <small>{product.reviews.toLocaleString('en-IN')} ratings and reviews</small></div><p className="detail-description">{product.description ?? 'A thoughtfully selected product for everyday use, with quality materials and reliable performance.'}</p><div className="detail-price">{money(product.price)} <del>{money(product.oldPrice)}</del><span>Inclusive of all taxes</span></div><div className="detail-field"><b>Availability</b><span className="in-stock">In stock · {product.stock} units</span></div><div className="detail-field"><b>Variant</b><div className="variant-row">{(product.variants ?? ['Standard']).map(item => <button className={variant === item ? 'selected' : ''} key={item} onClick={() => setVariant(item)}>{item}</button>)}</div></div><div className="detail-field"><b>Quantity</b><div className="quantity"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><span>{quantity}</span><button onClick={() => setQuantity(quantity + 1)}>+</button></div></div><div className="detail-actions"><button className="primary-button" onClick={() => setMessage(`${quantity} ${product.name} added to cart`)}>Add to cart <span>→</span></button><button className="secondary-button" onClick={() => setSaved(!saved)}>{saved ? '♥ Saved' : '♡ Save for later'}</button></div>{message && <p className="success-message"> {message}</p>}<div className="detail-meta"><span>GST {product.gst ?? 5}%</span><span>HSN {product.hsn ?? '00000000'}</span><span>7-day returns</span><span>Delivery estimate tomorrow</span></div></div></div>
}
