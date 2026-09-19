import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/customer/site-header'
import { ProductDetailLive } from '@/components/customer/product-detail-live'
import { getCatalogProduct } from '@/lib/catalog-server'

export const dynamic = 'force-dynamic'

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await getCatalogProduct(Number(id))
  if (!product) notFound()
  return <><SiteHeader /><main><ProductDetailLive product={product} /></main></>
}
