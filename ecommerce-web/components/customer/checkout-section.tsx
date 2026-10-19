import { forwardRef, type ReactNode } from 'react'
import { Check } from 'lucide-react'

type Props = { id?: string; number?: string; title: string; complete?: boolean; action?: ReactNode; children: ReactNode }

export const CheckoutSection = forwardRef<HTMLElement, Props>(function CheckoutSection({ id, number = '', title, complete = false, action, children }, ref) {
  return <section className="checkout-section" id={id} ref={ref}>
    <div className="checkout-section-heading">
      <span className={`checkout-section-number ${complete ? 'is-complete' : ''}`}>{complete ? <Check size={15} /> : number}</span>
      <h2>{title}</h2>
      <div className="checkout-section-action">{action ?? (complete ? <span className="checkout-complete-label"><Check size={13} /> Complete</span> : <span className="checkout-required-label">Required</span>)}</div>
    </div>
    {children}
  </section>
})
