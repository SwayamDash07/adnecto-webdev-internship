import { SiteHeader } from '@/components/customer/site-header'
import { CatalogueBrowser } from '@/components/customer/commerce-workflows'

export default function NewArrivalsPage() {
  return <><SiteHeader /><main className="module-page"><div className="module-heading"><div><p className="eyebrow">NEW IN</p><h1>New arrivals</h1><p>Recently added products from the live catalogue.</p></div></div><CatalogueBrowser /></main></>
}
