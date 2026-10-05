'use client'

import Link from 'next/link'
import { money } from '@/lib/formatters'
import type { Product } from '@/types/catalog'
import { cartStore } from '@/lib/cart-store'
import { showCartToast } from '@/components/shared/cart-toast'
import { ProductVisual } from './product-visual'
import { WishlistHeart } from './wishlist-heart'

export function CatalogProduct({ product }: { product: Product }) { return <article className="product-card"><Link href={('/customer/product/' + product.id) as never}><div className={`product-art ${product.color}`}><span className="product-badge">{product.badge}</span><ProductVisual product={product} /><WishlistHeart product={product} /></div></Link><div className="product-info"><div className="rating">★ {product.rating} <small>({product.reviews.toLocaleString('en-IN')})</small></div><h3>{product.name}</h3><p className="price">{money(product.price)} <del>{money(product.oldPrice)}</del></p><p className="delivery">Free delivery · Tomorrow</p><button className="add-button" disabled={!product.stock} onClick={() => cartStore.add(product) && showCartToast(`${product.name} added to cart`)}>{product.stock ? 'Add to cart' : 'Out of stock'}</button></div></article> }
