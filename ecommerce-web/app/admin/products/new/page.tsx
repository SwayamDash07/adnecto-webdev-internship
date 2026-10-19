import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AdminShell } from '@/components/admin/admin-shell'
import { NewProductForm } from '@/components/admin/products/new-product-form'
import { requireAdminRoute } from '@/lib/admin-auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { emptyProduct } from '@/constants/admin-product'

const routeToken = process.env.ADMIN_ROUTE_TOKEN ?? process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN
const routeBase = routeToken ? `/portal/${routeToken}` : '/404'
const productsHref = `${routeBase}/products`

export default async function NewProductPage() {
  await requireAdminRoute()
  const supabase = await createSupabaseServerClient()
  const [{ data: categoryRows }, { data: brandRows }] = await Promise.all([
    supabase.from('categories').select('name').order('sort_order').order('name'),
    supabase.from('products').select('brand').not('brand', 'is', null).order('brand'),
  ])
  const categories = [...new Set((categoryRows ?? []).map(row => row.name).filter(Boolean))]
  const brands = [...new Set((brandRows ?? []).map(row => row.brand?.trim()).filter((brand): brand is string => Boolean(brand)))]

  return <AdminShell eyebrow="CATALOGUE" title="Add product" description="Add a product to your live catalogue." action={<Link href={productsHref} className="product-back-link"><ArrowLeft size={15} />Back to products</Link>}>
    <div className="product-breadcrumb"><Link href={productsHref}>Products</Link><span>/</span><strong>Add product</strong></div>
    <NewProductForm initialValues={emptyProduct} categories={categories} brands={brands} gstOptions={[0, 5, 12, 18, 28]} productsHref={productsHref} />
  </AdminShell>
}
