'use client'

import { useEffect } from 'react'

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[admin] Page failed to render:', error)
  }, [error])

  return <main className="module-page"><section className="panel placeholder" role="alert"><h1>We couldn’t load this page</h1><p>Something interrupted the page load. Please retry.</p><button className="primary-button" onClick={() => reset()}>Try again</button></section></main>
}
