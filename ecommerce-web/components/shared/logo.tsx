import Link from 'next/link'

export function Logo({ dark = false }: { dark?: boolean }) {
  return <Link className={`brand ${dark ? 'brand-dark' : ''}`} href="/"><span className="brand-mark">C</span><span>cartly<span className="brand-dot">.</span></span></Link>
}
