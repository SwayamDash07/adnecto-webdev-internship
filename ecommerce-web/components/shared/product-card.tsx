'use client'
import type { Product } from '@/lib/types'
import { money } from '@/lib/data'
import { cartStore } from '@/lib/cart-store'
import { showCartToast } from './cart-toast'
import { useWishlist } from '@/lib/wishlist-store'
import { ProductModal } from './product-modal'
import { useState } from 'react'

export function ProductCard({ product }: { product: Product }) {
  const { saved, toggle } = useWishlist()
  const [open, setOpen] = useState(false)
  const addToCart = () => { if (cartStore.add(product)) showCartToast(`${product.name} added to cart`); setOpen(false) }
  return <>{<article className="product-card" onClick={() => setOpen(true)} onKeyDown={event => { if (event.key === 'Enter') setOpen(true) }} role="button" tabIndex={0}><div className={`product-art ${product.color}`}>{product.imageUrl ? <img className="product-photo" src={product.imageUrl} alt={product.name} /> : <span className="product-emoji">{product.emoji}</span>}<span className="product-badge">{product.badge}</span><button className={`heart wishlist-button ${saved.has(product.id) ? 'saved' : ''}`} aria-label={saved.has(product.id) ? 'Remove from wishlist' : 'Save product'} onClick={event => { event.stopPropagation(); void toggle(product) }}>{saved.has(product.id) ? '♥' : '♡'}</button></div><div className="product-info"><div className="rating">★ {product.rating} <small>({product.reviews.toLocaleString('en-IN')})</small></div><h3>{product.name}</h3><p className="price">{money(product.price)} <del>{money(product.oldPrice)}</del></p><p className="delivery">Free delivery · Tomorrow</p><button className="add-button" disabled={!product.stock} onClick={event => { event.stopPropagation(); addToCart() }}>{product.stock ? 'Add to cart' : 'Out of stock'}</button></div></article>}{open && <ProductModal product={product} onClose={() => setOpen(false)} onAdd={addToCart} />}</>
}
