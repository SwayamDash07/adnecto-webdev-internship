import Link from 'next/link'
import { Dumbbell, Home, Shirt, ShoppingBasket, ShoppingCart, Smartphone, Sparkles } from 'lucide-react'
import { ProductCard } from '@/components/shared/product-card'
import { SiteHeader } from './site-header'
import { PromoAds } from './promo-ads'
import { getCatalogCategories, getCatalogProducts } from '@/lib/catalog-server'
import { getActiveBanner } from '@/lib/banners-server'

const categoryIcons = { Groceries: ShoppingCart, 'Home appliances': Home, 'Personal care': Sparkles, Fashion: Shirt, Electronics: Smartphone, Sports: Dumbbell }

export async function Storefront() {
  const [products, categories, homepageBanner] = await Promise.all([getCatalogProducts(), getCatalogCategories(), getActiveBanner('homepage')])
  const offers = products.filter(product => product.oldPrice > product.price).slice(0, 4)
  const newArrivals = [...products].slice(-4).reverse()
  const bestSellers = [...products].sort((a, b) => b.reviews - a.reviews).slice(0, 4)
  const section = (eyebrow: string, title: string, items: typeof products) => <section className="catalog"><div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><Link className="view-all" href="/customer/search">View all</Link></div><div className="product-grid">{items.map(product => <ProductCard key={`${title}-${product.id}`} product={product} />)}</div></section>
  return <div><SiteHeader /><main><PromoAds banner={homepageBanner} /><section className="category-strip"><div className="category-strip-title"><span className="category-title-icon"><ShoppingBasket size={19} /></span><strong>Shop by category</strong><small>Everything for your home</small></div>{categories.map(category => { const Icon = categoryIcons[category.name as keyof typeof categoryIcons] ?? ShoppingBasket; return <Link href={`/customer/category/${category.slug}`} key={category.id}><span className="category-icon"><Icon size={18} strokeWidth={1.8} /></span><b>{category.name}</b></Link> })}</section>{section('TODAY\'S OFFERS', 'Flash deals', offers.length ? offers : products.slice(0, 4))}{section('BEST SELLERS', 'Popular with shoppers', bestSellers)}{section('NEW ARRIVALS', 'Fresh in store', newArrivals)}</main><footer className="site-footer"><span className="brand-footer">cartly<span className="brand-dot">.</span></span><span>Made for better everyday shopping</span><small className="demo-disclaimer">Demo website only. Products, brands, prices, imagery and availability are for UI demonstration and are not available for purchase. Cartly is not affiliated with or endorsed by the referenced brands.</small></footer></div>
}
