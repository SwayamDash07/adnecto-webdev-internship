'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { ProductCard } from '@/components/shared/product-card'
import { fetchCatalogProducts } from '@/lib/catalog-client'
import { useWishlist } from '@/lib/wishlist-store'
import type { Product } from '@/types/catalog'

export function CustomerWishlist() {
  const { saved } = useWishlist()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { let active = true; void fetchCatalogProducts().then(items => { if (active) { setProducts(items); setLoading(false) } }).catch(() => { if (active) setLoading(false) }); return () => { active = false } }, [])
  const items = products.filter(product => saved.has(product.id))
  return <section className="wishlist-page">{loading ? <div className="panel placeholder"><h2>Loading wishlist</h2></div> : items.length ? <div className="product-grid">{items.map(product => <ProductCard key={product.id} product={product} />)}</div> : <section className="panel wishlist-empty"><span className="wishlist-empty-icon"><Heart size={25} /></span><h2>Your wishlist is empty</h2><p>Save products you love and find them here whenever you return.</p><Link className="primary-button" href="/">Browse products</Link></section>}</section>
}
