import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerReturns } from '@/components/customer/customer-returns'

export default function CustomerReturnsPage() {
  return <CustomerPage title="Returns & refunds" description="Manage eligible returns and get help with refunds." cards={[]}><CustomerReturns /></CustomerPage>
}
