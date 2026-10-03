'use client'

import { useRouter } from 'next/navigation'

export function BackButton() {
  const router = useRouter()
  return <button type="button" className="secondary-button back-button" onClick={() => router.back()}>Back</button>
}
