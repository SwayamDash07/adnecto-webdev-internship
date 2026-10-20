import { CustomerPage } from '@/components/customer/customer-page'

export default function TrackingLoading() {
  return <CustomerPage title="Track your order" description="Follow the current status and delivery details for your order." cards={[]}>
    <div className="tracking-skeleton" aria-label="Loading order tracking"><div className="tracking-skeleton-line short" /><div className="tracking-skeleton-line heading" /><div className="tracking-skeleton-line wide" /><div className="tracking-skeleton-grid"><div className="tracking-skeleton-card"><i /><i /><i /><i /><i /><i /></div><div className="tracking-skeleton-card"><i /><i /><i /></div></div></div>
  </CustomerPage>
}
