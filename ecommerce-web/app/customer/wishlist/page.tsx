import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerWishlist } from '@/components/customer/customer-wishlist'

export default function CustomerWishlistPage() {
  return <CustomerPage title="Your wishlist" description="Keep your favourite products close and come back to them anytime." cards={[]}><CustomerWishlist /></CustomerPage>
}
