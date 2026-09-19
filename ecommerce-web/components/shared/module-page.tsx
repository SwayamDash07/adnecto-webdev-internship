import Link from 'next/link'
import { AdminShell } from '@/components/admin/admin-shell'

export function ModulePage({ title, description, cards, workflow, children }: { title: string; description: string; cards: Array<[string, string, string]>; workflow?: string[]; children?: React.ReactNode }) {
  return <AdminShell title={title} description={description}><div className="module-grid">{cards.map(([icon, heading, copy]) => <div className="feature-card" key={heading}><b>{icon}</b><h3>{heading}</h3><p>{copy}</p></div>)}</div>{workflow && <div className="workflow">{workflow.map((step, index) => <div className={`workflow-step ${index === 0 ? 'active' : ''}`} key={step}>{step}</div>)}</div>}{children || <section className="panel placeholder"><span>✦</span><h2>{title} workspace</h2><p>Interface ready for the Supabase-backed workflow. Connect validation, permissions, storage and realtime events here.</p></section>}</AdminShell>
}
