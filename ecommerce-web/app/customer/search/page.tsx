import { CustomerPage } from '@/components/customer/customer-page'
import { SearchResults } from './results'

export default function SearchPage() {
  return <CustomerPage title="Search products" description="Instant search, typo tolerance, barcode, SKU, brand and category search with detailed filters." cards={[["⌕", "Search", "Search by product, SKU, brand or category."], ["◇", "Filters", "Price, brand, weight, rating, discount and availability."], ["▦", "Categories", "Unlimited category nesting for a full hypermarket catalogue."]]}><SearchResults /></CustomerPage>
}
