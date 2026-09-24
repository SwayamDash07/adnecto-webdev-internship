import { ModulePage } from '@/components/shared/module-page'
import { AdminAccounts } from '@/components/admin/admin-accounts'
import { DeliverySlotManager } from '@/components/admin/delivery-slot-manager'

export default function SettingsPage() {
  return <ModulePage title="Store settings" description="Configure store identity, locations, delivery slots, tax rules and role permissions." cards={[["Store", "Store profile", "Brand, contact details, business identity and warehouse locations."], ["Slots", "Delivery slots", "Preferred delivery windows and scheduled delivery settings."], ["Roles", "Roles & permissions", "Super admin, store manager, accountant and inventory access."]]}><><AdminAccounts /><DeliverySlotManager /></></ModulePage>
}
