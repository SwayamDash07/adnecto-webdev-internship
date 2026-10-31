import Image from 'next/image'
import Link from 'next/link'

type PromoBanner = { image_url: string; title: string; copy: string | null; cta_label?: string | null; cta_href?: string | null }
const fallbackAds = { grocery: 'https://zvlbaufmahyfzvhqkuka.supabase.co/storage/v1/object/public/product-media/catalog/6b133d25fd8a7670a849724a94992e8e436da31e80559839ec110c2c8cca6ff8.jpg', wellness: 'https://zvlbaufmahyfzvhqkuka.supabase.co/storage/v1/object/public/product-media/catalog/3a81d5d65f1146f6d4d9689cd22edce36ef8aeb587961052c41a6ed403b42c20.jpg', fashion: 'https://zvlbaufmahyfzvhqkuka.supabase.co/storage/v1/object/public/product-media/catalog/c05ce10bc673f2bdd0f0b3e0468d70dd84c99253b6a996bdea705ced2bf850b4.jpg', home: 'https://zvlbaufmahyfzvhqkuka.supabase.co/storage/v1/object/public/product-media/catalog/42893b2508c7fab69f3b63c6552e0cd2594aa13bdfedbf1410bcfe9c434f3546.jpg' }

export function PromoAds({ banner }: { banner?: PromoBanner | null }) {
  return <section className="promo-ads" aria-label="Current offers"><Link className="promo-hero" href={banner?.cta_href ?? '/customer/category/groceries'}><Image src={fallbackAds.grocery} alt="Fresh groceries" fill priority sizes="(max-width: 680px) 92vw, 1280px" /><span className="promo-overlay" /><div className="promo-copy"><p className="eyebrow">FRESH PICKS · DELIVERED FAST</p><h1>{banner?.title ?? 'Stock up on daily essentials'}</h1><p>{banner?.copy ?? 'Farm-fresh groceries, pantry staples and everyday favourites delivered to your door.'}</p><span className="promo-button">{banner?.cta_label ?? 'Shop now'}</span></div></Link><div className="promo-grid"><PromoTile image={fallbackAds.wellness} title="Personal care delivered" copy="Daily essentials, self-care and wellness picks" href="/customer/category/personal-care" /><PromoTile image={fallbackAds.fashion} title="Fresh looks, easy shopping" copy="Everyday fashion for every plan" href="/customer/category/fashion" /><PromoTile image={fallbackAds.home} title="Make home feel better" copy="Comfort, kitchen and home essentials" href="/customer/category/home-appliances" /></div></section>
}

function PromoTile({ image, title, copy, href }: { image: string; title: string; copy: string; href: string }) {
  return <Link className="promo-tile" href={href}><Image src={image} alt="" fill sizes="(max-width: 680px) 92vw, 33vw" /><span className="promo-overlay" /><div className="promo-tile-copy"><h2>{title}</h2><p>{copy}</p><span className="promo-small-button">Shop now</span></div></Link>
}
