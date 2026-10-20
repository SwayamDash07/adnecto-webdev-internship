'use server'

import { requirePermission } from '@/lib/permissions'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AdjustmentLogRow } from '@/components/admin/inventory/inventory-manager'

const PAGE_SIZE = 20

export async function getInventoryAdjustmentPage(offset: number, search: string) {
  await requirePermission('inventory:view')
  const safeOffset = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_list_inventory_adjustments', {
    p_limit: PAGE_SIZE,
    p_offset: safeOffset,
    p_search: search.trim() || null,
  })
  return { rows: (data ?? []) as AdjustmentLogRow[], error: error?.message ?? '' }
}
