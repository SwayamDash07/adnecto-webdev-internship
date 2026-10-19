import { requireAdminRoute } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  await requireAdminRoute()
  return children
}
