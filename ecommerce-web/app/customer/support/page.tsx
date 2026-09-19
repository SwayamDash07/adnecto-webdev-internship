import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerSupport } from '@/components/customer/customer-support'

export default function CustomerSupportPage() {
  return <CustomerPage title="Customer support" description="Get help with an order, delivery, payment or product." cards={[]}><CustomerSupport /></CustomerPage>
}
