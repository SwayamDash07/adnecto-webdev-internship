'use client'

import Link from 'next/link'
import { ArrowRight, CircleHelp, PackageCheck, RotateCcw } from 'lucide-react'

export function CustomerReturns() {
  return <div className="returns-page"><section className="returns-hero panel"><span className="returns-icon"><RotateCcw size={24} /></span><div><p className="eyebrow">AFTER-SALES CARE</p><h2>Returns &amp; refunds</h2><p>Start a return from an eligible order and follow its progress in one place.</p></div></section><div className="returns-grid"><section className="panel returns-card"><PackageCheck size={20} /><h3>Need to return something?</h3><p>Open your orders, choose an eligible item, and select the reason for return.</p><Link className="primary-button" href="/customer/orders">View your orders <ArrowRight size={15} /></Link></section><section className="panel returns-card"><CircleHelp size={20} /><h3>Before you start</h3><ul><li>Most items can be returned within 7 days.</li><li>Keep the product and packaging ready.</li><li>Refund timing depends on the original payment method.</li></ul><Link className="secondary-button" href="/customer/support">Contact support</Link></section></div></div>
}
