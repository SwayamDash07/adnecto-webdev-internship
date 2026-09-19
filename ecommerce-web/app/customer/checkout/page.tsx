import { SiteHeader } from '@/components/customer/site-header'
import { LiveCheckoutFlow } from '@/components/customer/commerce-workflows'

export default function CheckoutPage() { return <><SiteHeader /><main className="module-page"><div className="module-heading"><div><p className="eyebrow">SECURE CHECKOUT</p><h1>Complete your order</h1><p>Choose your delivery preference and payment method.</p></div></div><LiveCheckoutFlow /></main></> }
