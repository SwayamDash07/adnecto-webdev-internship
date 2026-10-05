'use client'

import type { Product } from '@/types/catalog'
import { useWishlist } from '@/lib/wishlist-store'

export function WishlistHeart({ product }: { product: Product }) { const { saved, toggle } = useWishlist(); return <button className={`heart wishlist-button ${saved.has(product.id) ? 'saved' : ''}`} aria-label={saved.has(product.id) ? 'Remove from wishlist' : 'Save product'} onClick={event => { event.preventDefault(); void toggle(product) }}>{saved.has(product.id) ? '♥' : '♡'}</button> }
