'use client'

import { useState } from 'react'
import { cartStore } from '@/lib/cart-store'
import { showCartToast } from '@/components/shared/cart-toast'
import { useWishlist } from '@/lib/wishlist-store'
import { money } from '@/lib/data'
import Image from 'next/image'
import type { Product } from '@/lib/types'

export function ProductDetailLive({ product }: { product: Product }) {
  const [activeImage, setActiveImage] = useState(product.imageUrl ?? '')
  const [quantity, setQuantity] = useState(1)
  const { saved, toggle } = useWishlist()
  const images = [product.imageUrl, ...(product.gallery ?? [])].filter((image): image is string => Boolean(image))
  return <div className="product-detail"><div><div className={`detail-art product-art ${product.color}`}>{activeImage ? <Image className="product-photo" src={activeImage} alt={product.name} fill sizes="(max-width: 680px) 92vw, 50vw" priority /> : <span className="product-emoji">{product.emoji}</span>}</div>{images.length > 1 && <div className="gallery-thumbnails">{images.map(image => <button className={activeImage === image ? 'selected' : ''} key={image} onClick={() => setActiveImage(image)}><Image src={image} alt="" width={64} height={64} /></button>)}</div>}</div><div className="detail-copy"><p className="eyebrow">{product.brand ?? product.category} · SKU {product.sku ?? 'SKU-0001'}</p><h1>{product.name}</h1><div className="rating">★ {product.rating} <small>{product.reviews.toLocaleString('en-IN')} ratings and reviews</small></div><p className="detail-description">{product.description ?? 'A thoughtfully selected product for everyday use, with quality materials and reliable performance.'}</p><div className="detail-price">{money(product.price)} <del>{money(product.oldPrice)}</del><span>Inclusive of all taxes</span></div><div className="detail-field"><b>Availability</b><span className={product.stock ? 'in-stock' : 'low-stock'}>{product.stock ? `In stock · ${product.stock} units` : 'Out of stock'}</span></div><div className="detail-field"><b>Quantity</b><div className="quantity"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><span>{quantity}</span><button disabled={quantity >= product.stock} onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}>+</button></div></div><div className="detail-actions"><button className="primary-button" disabled={!product.stock} onClick={() => { cartStore.add(product, quantity); showCartToast(`${quantity} ${product.name} added to cart`) }}>{product.stock ? 'Add to cart' : 'Out of stock'}</button><button className="secondary-button" onClick={() => void toggle(product)}>{saved.has(product.id) ? 'Saved' : 'Save for later'}</button></div><div className="detail-meta"><span>GST {product.gst ?? 5}%</span><span>HSN {product.hsn ?? '00000000'}</span><span>7-day returns</span></div></div></div>
}
