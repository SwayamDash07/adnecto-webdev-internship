import { SiteHeader } from '@/components/customer/site-header'
import { LiveCheckoutFlow } from '@/components/customer/live-checkout-flow'
import { BackButton } from '@/components/shared/back-button'
import { getCurrentCartSnapshot } from '@/lib/cart-server'
import { requireCustomerRoute } from '@/lib/customer-auth'
import { getCheckoutDeliveryOptions } from '@/lib/delivery-slots-server'

export default async function CheckoutPage() {
  const { supabase } = await requireCustomerRoute('/customer/checkout')
  const [cart, deliveryOptions] = await Promise.all([getCurrentCartSnapshot(), getCheckoutDeliveryOptions()])
  const { data: addresses, error: addressError } = await supabase.from('addresses').select('id,label,line1,city,postal_code').order('id')
  return <><SiteHeader /><main className="module-page checkout-page"><div className="module-heading checkout-page-heading"><div><p className="eyebrow">SECURE CHECKOUT</p><h1>Checkout</h1><p>Secure checkout - account required</p></div><BackButton /></div><LiveCheckoutFlow initialCartLines={cart.lines} initialCartReady={cart.isAuthenticated} initialAddresses={(addresses ?? []) as never[]} initialDeliveryOptions={deliveryOptions} initialDataError={addressError?.message ?? ''} /></main></>
}
