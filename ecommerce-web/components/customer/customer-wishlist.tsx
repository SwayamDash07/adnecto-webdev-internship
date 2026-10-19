'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { ProductCard } from '@/components/shared/product-card'
import { useWishlist } from '@/lib/wishlist-store'
import type { Product } from '@/types/catalog'

export function CustomerWishlist({ products, initialSavedProductIds }: { products: Product[]; initialSavedProductIds: number[] }) {
  const { saved, ready } = useWishlist()
  const [serverSaved] = useState(() => new Set(initialSavedProductIds))
  const [clientReady, setClientReady] = useState(false)
  useEffect(() => { if (ready) setClientReady(true) }, [ready, saved])
  const visibleIds = clientReady ? saved : serverSaved
  const items = products.filter(product => visibleIds.has(product.id))
  return <section className="wishlist-page">{items.length ? <div className="product-grid">{items.map(product => <ProductCard key={product.id} product={product} />)}</div> : <section className="panel wishlist-empty"><span className="wishlist-empty-icon"><Heart size={25} /></span><h2>Your wishlist is empty</h2><p>Save products you love and find them here whenever you return.</p><Link className="primary-button" href="/">Browse products</Link></section>}</section>
}
