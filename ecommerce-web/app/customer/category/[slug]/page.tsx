import { getCatalogProducts } from '@/lib/catalog-server'
import { ProductCard } from '@/components/shared/product-card'
import { CustomerPage } from '@/components/customer/customer-page'
import { CategoryBanner } from '@/components/customer/category-banner'

export const dynamic = 'force-dynamic'

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const matches = await getCatalogProducts({ categorySlug: slug })
  const title = matches[0]?.category ?? slug.replaceAll('-', ' ').replace(/\b\w/g, character => character.toUpperCase())
  return <CustomerPage title={title} description={`Browse ${title.toLowerCase()} products, ratings, availability and delivery estimates.`} cards={[["◇", "Category filters", "Price, brand, rating, discount and availability."], ["▣", "Product types", "Simple, variable, loose weight, combo and gift pack."], ["⌁", "Delivery estimate", "Location-aware delivery estimate and preferred slots."]]}><CategoryBanner slug={slug} /><div className="product-grid search-results">{matches.length ? matches.map(product => <ProductCard key={product.id} product={product} />) : <section className="panel placeholder"><span>⌕</span><h2>No products in {title}</h2><p>We are adding more products to this category soon.</p></section>}</div></CustomerPage>
}
