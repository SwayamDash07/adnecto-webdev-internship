import { LiveProductManager } from '@/components/admin/products/live-product-manager'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AdminProduct } from '@/types/admin'

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_list_products')
  const initialFilters = {
    search: typeof params.search === 'string' ? params.search : '',
    category: typeof params.category === 'string' ? params.category : '',
    status: typeof params.status === 'string' ? params.status : '',
    stock: typeof params.stock === 'string' ? params.stock : '',
    sort: typeof params.sort === 'string' ? params.sort : '',
    page: typeof params.page === 'string' ? params.page : '',
  }
  return <LiveProductManager initialProducts={(data ?? []) as AdminProduct[]} initialError={error?.message ?? ''} initialFilters={initialFilters} />
}
