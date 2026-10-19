import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerWishlist } from '@/components/customer/customer-wishlist'
import { getCatalogProducts } from '@/lib/catalog-server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function CustomerWishlistPage() {
  const [products, supabase] = await Promise.all([getCatalogProducts(), createSupabaseServerClient()])
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = user
    ? await supabase.from('wishlists').select('product_id').eq('user_id', user.id)
    : { data: [] as { product_id: number }[] }
  return <CustomerPage title="Your wishlist" description="Keep your favourite products close and come back to them anytime." cards={[]}><CustomerWishlist products={products} initialSavedProductIds={(data ?? []).map(row => Number(row.product_id))} /></CustomerPage>
}
