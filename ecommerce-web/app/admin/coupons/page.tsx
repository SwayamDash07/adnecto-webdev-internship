import { LiveCouponManager } from '@/components/admin/coupons/live-coupon-manager'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AdminCoupon } from '@/types/admin'

export default async function CouponsPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_list_coupons')
  return <LiveCouponManager initialCoupons={(data ?? []) as AdminCoupon[]} initialError={error?.message ?? ''} />
}
