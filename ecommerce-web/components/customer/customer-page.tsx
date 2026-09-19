import Link from 'next/link'
import { SiteHeader } from './site-header'

export function CustomerPage({ title, description, cards, children }: { title: string; description: string; cards: Array<[string, string, string]>; children?: React.ReactNode }) {
  return <><SiteHeader /><main className="module-page"><div className="module-heading"><div><p className="eyebrow">CUSTOMER ACCOUNT</p><h1>{title}</h1><p>{description}</p></div><Link className="secondary-button" href="/">← Continue shopping</Link></div><div className="module-grid">{cards.map(([icon, heading, copy]) => <div className="feature-card" key={heading}><b>{icon}</b><h3>{heading}</h3><p>{copy}</p></div>)}</div>{children || <section className="panel placeholder"><span>✦</span><h2>{title}</h2><p>This customer-facing area is structured for the Supabase data and logic layer to be connected later.</p></section>}</main></>
}
