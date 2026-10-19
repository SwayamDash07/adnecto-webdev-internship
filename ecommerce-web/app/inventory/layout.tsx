import { requireAdminRoute } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  await requireAdminRoute()
  return children
}
