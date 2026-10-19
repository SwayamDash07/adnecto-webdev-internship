'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'

export function CartMobileSummary({ total, hasUnavailable, children }: { total: string; hasUnavailable: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return <div className="cart-mobile-summary"><button type="button" className="cart-mobile-summary-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}><span><small>Total</small><strong>{total}</strong></span>{open ? <ChevronDown size={18} /> : <ChevronUp size={18} />}</button>{open && <div className="cart-mobile-summary-details">{children}</div>}<Link href={hasUnavailable ? '#' : '/customer/checkout'} aria-disabled={hasUnavailable} onClick={event => { if (hasUnavailable) event.preventDefault() }} className={`primary-button cart-mobile-checkout ${hasUnavailable ? 'is-disabled' : ''}`}>Checkout <ArrowRight size={17} /></Link></div>
}
