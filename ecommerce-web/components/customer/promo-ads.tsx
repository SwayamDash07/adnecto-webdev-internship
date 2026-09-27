import Image from 'next/image'
import Link from 'next/link'

type PromoBanner = { image_url: string; title: string; copy: string | null; cta_label?: string | null; cta_href?: string | null }
const fallbackAds = { grocery: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1800&q=85', wellness: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=800&q=85', fashion: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=85', home: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=800&q=85' }

export function PromoAds({ banner }: { banner?: PromoBanner | null }) {
  return <section className="promo-ads" aria-label="Current offers"><Link className="promo-hero" href={banner?.cta_href ?? '/customer/category/groceries'}><Image src={fallbackAds.grocery} alt="Fresh groceries" fill priority sizes="(max-width: 680px) 92vw, 1280px" /><span className="promo-overlay" /><div className="promo-copy"><p className="eyebrow">FRESH PICKS · DELIVERED FAST</p><h1>{banner?.title ?? 'Stock up on daily essentials'}</h1><p>{banner?.copy ?? 'Farm-fresh groceries, pantry staples and everyday favourites delivered to your door.'}</p><span className="promo-button">{banner?.cta_label ?? 'Shop now'}</span></div></Link><div className="promo-grid"><PromoTile image={fallbackAds.wellness} title="Personal care delivered" copy="Daily essentials, self-care and wellness picks" href="/customer/category/personal-care" /><PromoTile image={fallbackAds.fashion} title="Fresh looks, easy shopping" copy="Everyday fashion for every plan" href="/customer/category/fashion" /><PromoTile image={fallbackAds.home} title="Make home feel better" copy="Comfort, kitchen and home essentials" href="/customer/category/home-appliances" /></div></section>
}

function PromoTile({ image, title, copy, href }: { image: string; title: string; copy: string; href: string }) {
  return <Link className="promo-tile" href={href}><Image src={image} alt="" fill sizes="(max-width: 680px) 92vw, 33vw" /><span className="promo-overlay" /><div className="promo-tile-copy"><h2>{title}</h2><p>{copy}</p><span className="promo-small-button">Shop now</span></div></Link>
}
