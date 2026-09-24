import { SiteHeader } from '@/components/customer/site-header'
import { CatalogueBrowser } from '@/components/customer/commerce-workflows'

export default function OffersPage() {
  return <><SiteHeader /><main className="module-page"><div className="module-heading"><div><p className="eyebrow">DEALS</p><h1>Today&apos;s offers</h1><p>Live catalogue pricing, discounts, availability and ratings.</p></div></div><CatalogueBrowser /></main></>
}
