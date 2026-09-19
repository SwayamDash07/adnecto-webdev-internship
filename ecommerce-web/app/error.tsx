'use client'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="module-page"><section className="panel placeholder"><h1>Something went wrong</h1><p>We couldn&apos;t load this page. Please try again.</p><button className="primary-button" onClick={() => reset()}>Try again</button></section></main>
}
