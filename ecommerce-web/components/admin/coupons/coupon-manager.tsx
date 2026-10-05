'use client'

import { useState } from 'react'
import { AdminShell } from '../admin-shell'
import { type CouponRule } from '@/lib/services/admin'

export function CouponManager() {
  const [rule, setRule] = useState<CouponRule>({ name: 'Cartly10', type: 'Percentage discount', value: '10', scope: 'First order', starts: '', ends: '', active: true })
  return <AdminShell title="Coupon engine" description="Percentage, flat, buy X get Y, free delivery, first order, category, brand and time-based rules."><section className="panel form-panel"><h2>Coupon rule builder</h2><div className="form-grid"><label>Coupon name<input value={rule.name} onChange={event => setRule({ ...rule, name: event.target.value })} /></label><label>Discount type<select value={rule.type} onChange={event => setRule({ ...rule, type: event.target.value })}><option>Percentage discount</option><option>Flat discount</option><option>Buy X get Y</option><option>Free delivery</option></select></label><label>Value<input value={rule.value} onChange={event => setRule({ ...rule, value: event.target.value })} /></label><label>Scope<select value={rule.scope} onChange={event => setRule({ ...rule, scope: event.target.value })}><option>First order</option><option>All customers</option><option>Category</option><option>Brand</option></select></label><label>Starts<input type="datetime-local" value={rule.starts} onChange={event => setRule({ ...rule, starts: event.target.value })} /></label><label>Ends<input type="datetime-local" value={rule.ends} onChange={event => setRule({ ...rule, ends: event.target.value })} /></label></div><label className="checkbox-line"><input type="checkbox" checked={rule.active} onChange={event => setRule({ ...rule, active: event.target.checked })} /> Active coupon</label><button className="primary-button">Save coupon rule</button></section></AdminShell>
}
