import Link from 'next/link'
import Image from 'next/image'
import { ProductCard } from '@/components/shared/product-card'
import { SiteHeader } from './site-header'

import { getCatalogCategories, getCatalogProducts } from '@/lib/catalog-server'
import { getActiveBanner } from '@/lib/banners-server'

const categoryIcons: Record<string, string> = { Groceries: '🛒', 'Home appliances': '🧺', 'Personal care': '🧴', Fashion: '👟', Electronics: '📱' }

export async function Storefront() {
  const [products, categories, homepageBanner] = await Promise.all([getCatalogProducts(), getCatalogCategories(), getActiveBanner('homepage')])
  const offers = products.filter(product => product.oldPrice > product.price).slice(0, 4)
  const newArrivals = [...products].slice(-4).reverse()
  const bestSellers = [...products].sort((a, b) => b.reviews - a.reviews).slice(0, 4)
  const section = (eyebrow: string, title: string, items: typeof products) => <section className="catalog"><div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><Link className="view-all" href="/customer/search">View all</Link></div><div className="product-grid">{items.map(product => <ProductCard key={`${title}-${product.id}`} product={product} />)}</div></section>
  return <div><SiteHeader /><main><section className="hero">{homepageBanner && <Image className="hero-background" src={homepageBanner.image_url} alt="" fill priority sizes="(max-width: 680px) 92vw, 1280px" />}<div className="hero-copy"><p className="eyebrow">FRESH EVERY DAY · DELIVERED FAST</p><h1>{homepageBanner?.title ?? <>Good food.<br /><em>Good mood.</em></>}</h1><p>{homepageBanner?.copy ?? 'Everyday essentials, pantry staples and little luxuries, all in one happy basket.'}</p><Link className="primary-button" href="/customer/category/groceries">Shop groceries</Link><span className="hero-delivery">Same-day delivery in select areas</span></div>{!homepageBanner && <div className="hero-visual"><div className="sun-disc" /><div className="hero-card card-one">🥬<span>Fresh produce</span></div><div className="hero-card card-two">🍓<span>Seasonal picks</span></div><div className="hero-card card-three">🥖<span>Bakery</span></div><div className="hero-note">Save up to <strong>60% off</strong><br />on everyday favourites</div></div>}</section><section className="category-strip"><div className="category-strip-title"><span>🧺</span><strong>Shop by category</strong><small>Everything for your home</small></div>{categories.map(category => <Link href={`/customer/category/${category.slug}`} key={category.id}><span>{categoryIcons[category.name] ?? '◇'}</span><b>{category.name}</b></Link>)}</section><section className="trust-row"><div><b>✦</b><span><strong>Quality checked</strong><small>Trusted brands, always</small></span></div><div><b>↺</b><span><strong>Easy returns</strong><small>7 days, no questions</small></span></div><div><b>◇</b><span><strong>Secure payments</strong><small>UPI, cards or COD</small></span></div><div><b>◷</b><span><strong>On-time delivery</strong><small>Right when you need it</small></span></div></section>{section('TODAY\'S OFFERS', 'Flash deals', offers.length ? offers : products.slice(0, 4))}{section('BEST SELLERS', 'Popular with shoppers', bestSellers)}{section('NEW ARRIVALS', 'Fresh in store', newArrivals)}</main><footer className="site-footer"><span className="brand-footer">cartly<span className="brand-dot">.</span></span><span>Made for better everyday shopping</span></footer></div>
}
