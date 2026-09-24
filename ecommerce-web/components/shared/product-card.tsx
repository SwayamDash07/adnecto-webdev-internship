'use client'
import type { Product } from '@/lib/types'
import { money } from '@/lib/data'
import { cartStore } from '@/lib/cart-store'
import { showCartToast } from './cart-toast'
import { useWishlist } from '@/lib/wishlist-store'
import { ProductModal } from './product-modal'
import { useState } from 'react'
import Image from 'next/image'
import { Check, Eye, Heart, ShoppingCart } from 'lucide-react'

export function ProductCard({ product }: { product: Product }) {
  const { saved, toggle } = useWishlist()
  const [open, setOpen] = useState(false)
  const [added, setAdded] = useState(false)
  const addToCart = () => { if (cartStore.add(product)) { showCartToast(`${product.name} added to cart`); setAdded(true); window.setTimeout(() => setAdded(false), 1200) }; setOpen(false) }
  return <>{<article className="product-card" onClick={() => setOpen(true)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(true) } }} role="button" tabIndex={0}>
    <div className={`product-art ${product.color}`}>
      {product.imageUrl ? <Image className="product-photo" src={product.imageUrl} alt={product.name} fill sizes="(max-width: 680px) 50vw, 25vw" style={{ objectFit: 'cover' }} /> : <span className="product-emoji">{product.emoji}</span>}
      <span className="product-badge">{product.badge}</span>
      <div className="product-actions"><button className={`heart wishlist-button ${saved.has(product.id) ? 'saved' : ''}`} aria-label={saved.has(product.id) ? 'Remove from wishlist' : 'Save product'} onClick={event => { event.stopPropagation(); void toggle(product) }}>{saved.has(product.id) ? <Heart fill="currentColor" size={16} /> : <Heart size={16} />}</button><button className="quick-view" aria-label={`Quick view ${product.name}`} onClick={event => { event.stopPropagation(); setOpen(true) }}><Eye size={16} /></button></div>
    </div>
    <div className="product-info"><div className="rating"><span>★</span> {product.rating} <small>({product.reviews.toLocaleString('en-IN')})</small></div><h3>{product.name}</h3><p className="price">{money(product.price)} <del>{money(product.oldPrice)}</del></p><p className="delivery">Free delivery · Tomorrow</p><button className={`add-button ${added ? 'is-added' : ''}`} disabled={!product.stock} onClick={event => { event.stopPropagation(); addToCart() }}>{added ? <><Check size={15} /> Added to cart</> : product.stock ? <><ShoppingCart size={15} /> Add to cart</> : 'Out of stock'}</button></div>
  </article>}{open && <ProductModal product={product} onClose={() => setOpen(false)} onAdd={addToCart} />}</>
}
