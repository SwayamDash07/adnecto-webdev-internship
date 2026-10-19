import { LiveProductManager } from '@/components/admin/products/live-product-manager'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AdminProduct } from '@/types/admin'

export default async function ProductsPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_list_products')
  return <LiveProductManager initialProducts={(data ?? []) as AdminProduct[]} initialError={error?.message ?? ''} />
}
