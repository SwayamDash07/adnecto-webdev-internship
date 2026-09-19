import { CustomerPage } from '@/components/customer/customer-page'

export default function OffersPage() {
  return <CustomerPage title="Today’s offers" description="Flash deals, best sellers, frequently bought together and new arrivals." cards={[["⚡", "Flash deals", "Time-based offers with clear discount and availability states."], ["★", "Best sellers", "Popular products with ratings and reviews."], ["✦", "Frequently bought together", "Bundle suggestions ready for the future cart engine."]]}/>
}
