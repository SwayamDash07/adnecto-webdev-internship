import { SiteHeader } from '@/components/customer/site-header'
import { CatalogueBrowser } from '@/components/customer/products/catalogue-browser'
import { getCatalogCategories, getCatalogProducts } from '@/lib/catalog-server'
import { catalogueFiltersFromParams } from '@/lib/catalogue-filters'

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const [params, products, categories] = await Promise.all([searchParams, getCatalogProducts(), getCatalogCategories()])
  return <><SiteHeader /><main className="module-page"><div className="module-heading"><div><p className="eyebrow">DEALS</p><h1>Today&apos;s offers</h1><p>Live catalogue pricing, discounts, availability and ratings.</p></div></div><CatalogueBrowser initialProducts={products} initialCategories={categories.map(category => category.name)} initialQuery={Array.isArray(params.q) ? params.q[0] ?? '' : params.q ?? ''} initialFilters={catalogueFiltersFromParams(params)} /></main></>
}
