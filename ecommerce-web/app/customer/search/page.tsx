import { CustomerPage } from '@/components/customer/customer-page'
import { CatalogueBrowser } from '@/components/customer/products/catalogue-browser'
import { getCatalogCategories, getCatalogProducts } from '@/lib/catalog-server'
import { catalogueFiltersFromParams } from '@/lib/catalogue-filters'

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const [params, products, categories] = await Promise.all([searchParams, getCatalogProducts(), getCatalogCategories()])
  const query = Array.isArray(params.q) ? params.q[0] ?? '' : params.q ?? ''
  return <CustomerPage title="Search products" description="Find products quickly, then refine the results with product-specific filters." cards={[]}><CatalogueBrowser initialProducts={products} initialCategories={categories.map(category => category.name)} initialQuery={query} initialFilters={catalogueFiltersFromParams(params)} /></CustomerPage>
}
