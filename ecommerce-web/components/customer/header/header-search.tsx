'use client'

import type { FormEvent } from 'react'
import { Search } from 'lucide-react'

export function HeaderSearch({ query, setQuery, submitSearch }: { query: string; setQuery: (value: string) => void; submitSearch: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="search-bar" onSubmit={submitSearch} role="search"><label className="sr-only" htmlFor="site-search">Search products</label><button className="search-bar-icon" type="submit" aria-label="Search"><Search size={18} strokeWidth={2.2} /></button><input id="site-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search" /><button className="sr-only" type="submit" aria-label="Search">Search</button></form>
}
