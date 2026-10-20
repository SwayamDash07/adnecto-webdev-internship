import { InventoryManager } from '@/components/admin/inventory/inventory-manager'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { InventoryItem, AdjustmentLogRow } from '@/components/admin/inventory/inventory-manager'

export default async function AdminInventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const [inventory, log] = await Promise.all([
    supabase.rpc('admin_list_inventory'),
    supabase.rpc('admin_list_inventory_adjustments', { p_limit: 20, p_offset: 0, p_search: typeof params.logSearch === 'string' ? params.logSearch : null }),
  ])
  return <InventoryManager initialItems={(inventory.data ?? []) as InventoryItem[]} initialLog={(log.data ?? []) as AdjustmentLogRow[]} initialFilters={{ stock: typeof params.stock === 'string' ? params.stock : '', logSearch: typeof params.logSearch === 'string' ? params.logSearch : '' }} initialErrors={{ inventory: inventory.error ? 'We could not load inventory. Please try again.' : '', log: log.error ? 'We could not load the adjustment log. Please try again.' : '' }} />
}
