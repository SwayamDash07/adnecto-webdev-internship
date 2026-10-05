'use client'

import Link from 'next/link'
import { ArrowRight, PackageCheck } from 'lucide-react'

export function AccountQuickLinks() {
  return <div className="account-quick-links"><Link href="/customer/orders" className="account-quick-link"><PackageCheck size={18} /><span><strong>Your orders</strong><small>Track purchases and deliveries</small></span><ArrowRight size={16} /></Link><Link href="/customer/returns" className="account-quick-link"><PackageCheck size={18} /><span><strong>Returns &amp; refunds</strong><small>Start or track a return</small></span><ArrowRight size={16} /></Link></div>
}
