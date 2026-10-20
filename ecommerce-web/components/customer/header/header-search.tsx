'use client'

import { Search } from 'lucide-react'
import { useHeaderState } from './header-state'

export function HeaderSearch() {
  const { query, setQuery, submitSearch } = useHeaderState()
  return <form className="search-bar" onSubmit={submitSearch} role="search"><label className="sr-only" htmlFor="site-search">Search products</label><button className="search-bar-icon" type="submit" aria-label="Search"><Search size={18} strokeWidth={2.2} /></button><input id="site-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search" /><button className="sr-only" type="submit" aria-label="Search">Search</button></form>
}
