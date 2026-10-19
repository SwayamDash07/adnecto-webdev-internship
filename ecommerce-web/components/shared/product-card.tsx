'use client'
import type { Product } from '@/types/catalog'
import { fallbackProductImage } from '@/constants/catalog'
import { money } from '@/lib/formatters'
import { useWishlist } from '@/lib/wishlist-store'
import { ProductModal } from './product-modal'
import { useState } from 'react'
import Image from 'next/image'
import { Heart } from 'lucide-react'
import { uncroppedProductImage } from '@/lib/product-image'
import { CartAddControl } from './cart-add-control'

export function ProductCard({ product }: { product: Product }) {
  const { saved, toggle } = useWishlist()
  const [open, setOpen] = useState(false)
  return <>{<article className="product-card" onClick={() => setOpen(true)} onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(true) } }} role="button" tabIndex={0}>
    <div className={`product-art ${product.color}`}>
      <Image className="product-photo" src={uncroppedProductImage(product.imageUrl ?? fallbackProductImage)} alt={product.name} fill sizes="(max-width: 680px) 50vw, 25vw" style={{ objectFit: 'contain', objectPosition: 'center' }} />
      <span className="product-badge">{product.badge}</span>
      <div className="product-actions"><button className={`heart wishlist-button ${saved.has(product.id) ? 'saved' : ''}`} aria-label={saved.has(product.id) ? 'Remove from wishlist' : 'Save product'} onClick={event => { event.stopPropagation(); void toggle(product) }}>{saved.has(product.id) ? <Heart fill="currentColor" size={16} /> : <Heart size={16} />}</button></div>
    </div>
    <div className="product-info"><div className="rating"><span>★</span> {product.rating} <small>({product.reviews.toLocaleString('en-IN')})</small></div><h3>{product.name}</h3><p className="price">{money(product.price)} <del>{money(product.oldPrice)}</del></p><p className="delivery">Free delivery · Tomorrow</p><div onClick={event => event.stopPropagation()}><CartAddControl product={product} /></div></div>
  </article>}{open && <ProductModal product={product} onClose={() => setOpen(false)} />}</>
}
