import { CustomerPage } from '@/components/customer/customer-page'

export default function NewArrivalsPage() {
  return <CustomerPage title="New arrivals" description="Fresh products across grocery, personal care, home and electronics." cards={[["✦", "New products", "New brands and products ready to be discovered."], ["★", "Reviews & ratings", "Customer opinions and ratings for confident shopping."], ["♡", "Wishlist", "Save products for later and return to them from your dashboard."]]}/>
}
