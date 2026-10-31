import 'server-only'
import { NextResponse } from 'next/server'
import { z } from 'zod'

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

/** A small local fallback limiter. Use a shared edge limiter (for example Upstash) in multi-instance production. */
export function rateLimit(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfter: 0 }
  }
  current.count += 1
  return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), retryAfter: Math.ceil((current.resetAt - now) / 1000) }
}

export function limitedResponse(retryAfter: number) {
  return NextResponse.json({ error: 'RATE_LIMITED', retryAfter }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })
}

export async function parseJson<T extends z.ZodTypeAny>(request: Request, schema: T) {
  try {
    return { data: schema.parse(await request.json()) as z.infer<T>, error: null }
  } catch {
    return { data: null, error: NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 }) }
  }
}

export const authSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(8).max(128) })
