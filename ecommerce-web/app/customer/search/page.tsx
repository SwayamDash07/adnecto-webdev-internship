import { CustomerPage } from '@/components/customer/customer-page'
import { SearchResults } from './results'

export default function SearchPage() {
  return <CustomerPage title="Search products" description="Find products quickly, then refine the results with product-specific filters." cards={[]}><SearchResults /></CustomerPage>
}
