import { LivePurchaseManagerV2 } from '@/components/admin/purchases/live-purchase-manager-v2'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAdminProfile } from '@/lib/admin-auth'
import type { AdminProduct, PurchaseOrder } from '@/types/admin'

export default async function AdminPurchaseOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const [profile, supabase] = await Promise.all([getAdminProfile(), createSupabaseServerClient()])
  const [orders, products] = await Promise.all([supabase.rpc('admin_list_purchase_orders'), supabase.rpc('admin_list_products')])
  return <LivePurchaseManagerV2 initialOrders={(orders.data ?? []) as PurchaseOrder[]} initialProducts={(products.data ?? []) as AdminProduct[]} initialName={profile?.full_name || 'Cartly admin'} initialError={orders.error?.message ?? products.error?.message ?? ''} initialFilters={{ search: typeof params.search === 'string' ? params.search : '', status: typeof params.status === 'string' ? params.status : '', supplier: typeof params.supplier === 'string' ? params.supplier : '', sort: typeof params.sort === 'string' ? params.sort : '', page: typeof params.page === 'string' ? params.page : '' }} />
}
