'use client'

import Image from 'next/image'
import { placements } from '@/constants/admin-banners'
import type { Banner } from '@/types/admin-banner'

export function BannerLibrary({ banners, load, edit }: { banners: Banner[]; load: () => void; edit: (banner: Banner) => void }) {
  return <section className="panel banner-library"><div className="panel-heading"><div><p className="eyebrow">CAMPAIGN LIBRARY</p><h2>Published posters</h2><p>{banners.length} poster{banners.length === 1 ? '' : 's'} in your catalogue.</p></div><button className="secondary-button" onClick={() => void load()}>Refresh</button></div><div className="banner-list">{banners.length ? banners.map(banner => <article className="banner-library-card" key={banner.banner_id}><div className="banner-library-image"><Image src={banner.image_url} alt="" fill unoptimized sizes="240px" /></div><div className="banner-library-copy"><div><span className={`banner-status ${banner.active ? 'is-active' : ''}`}>{banner.active ? 'Live' : 'Draft'}</span><small>{placements.find(([value]) => value === banner.placement)?.[1] ?? banner.placement}</small></div><h3>{banner.title}</h3>{banner.copy && <p>{banner.copy}</p>}<button className="link-button" onClick={() => edit(banner)}>Edit poster</button></div></article>) : <div className="banner-empty"><span>▧</span><strong>No posters yet</strong><p>Upload your first promotional poster to start a campaign.</p></div>}</div></section>
}
