import { Suspense } from 'react'
import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerOrderTracking } from '@/components/customer/customer-order-tracking'

export default function TrackingPage() {
  return <CustomerPage title="Track your order" description="Follow the current status and delivery details for your order." cards={[]}><Suspense fallback={<section className="panel placeholder"><h2>Loading order...</h2></section>}><CustomerOrderTracking /></Suspense></CustomerPage>
}
