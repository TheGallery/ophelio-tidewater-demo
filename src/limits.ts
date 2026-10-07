import type { Context } from 'hono'
import type { Env } from './types.js'

const IP_LIMITS = {
  join: { windowMs: 60 * 60 * 1000, max: 3 },
  default: { windowMs: 60 * 1000, max: 60 },
}

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

function now() {
  return Date.now()
}

function key(ip: string, name: string) {
  return `${ip}:${name}`
}

function isAllowed(
  ip: string,
  name: 'join' | 'default',
): { allowed: boolean; retryAfter?: number } {
  const limit = IP_LIMITS[name]
  const k = key(ip, name)
  const current = now()
  let bucket = buckets.get(k)
  if (!bucket || bucket.resetAt <= current) {
    bucket = { count: 0, resetAt: current + limit.windowMs }
    buckets.set(k, bucket)
  }
  if (bucket.count >= limit.max) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - current) / 1000) }
  }
  bucket.count += 1
  return { allowed: true }
}

export async function rateLimit(
  c: Context<{ Bindings: Env }>,
  name: 'join' | 'default' = 'default',
) {
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown'
  const limiter = name === 'join' ? c.env.JOIN_LIMITER : c.env.REQUEST_LIMITER
  const result = limiter
    ? { allowed: (await limiter.limit({ key: `${name}:${ip}` })).success, retryAfter: 60 }
    : isAllowed(ip, name)
  if (!result.allowed) {
    c.header('Retry-After', String(result.retryAfter))
    return c.text('Too many requests. Please slow down.', 429)
  }
  return undefined
}

export async function verifyTurnstile(
  token: string | undefined,
  secretKey: string | undefined,
): Promise<boolean> {
  if (!secretKey) return true
  if (!token) return false
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: secretKey, response: token }),
  })
  const body = (await response.json()) as { success?: boolean }
  return body.success === true
}
