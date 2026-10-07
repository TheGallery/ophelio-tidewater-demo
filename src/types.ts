export type Env = {
  OPHELIO_API_KEY: string
  COOKIE_SECRET: string
  TURNSTILE_SITE_KEY?: string
  TURNSTILE_SECRET_KEY?: string
  VISITORS: KVNamespace
  JOIN_LIMITER?: RateLimit
  REQUEST_LIMITER?: RateLimit
}

export type TraceCall = {
  name: string
  request?: string
  response?: unknown
  cached?: boolean
}
