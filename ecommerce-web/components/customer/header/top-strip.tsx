import { FREE_DELIVERY_THRESHOLD } from '@/lib/support-config'
export function TopStrip() {
  return <div className="top-strip"><span>Free delivery on orders of ₹{FREE_DELIVERY_THRESHOLD.toLocaleString('en-IN')}+</span><i /> <span>Easy 7-day returns</span><i /> <span>Shop with confidence</span></div>
}
