import { Ophelio } from '@ophelio/sdk'
import type { TraceCall } from './types.js'

// The names the Behind the scenes drawer uses, each a function in src/ophelio.ts.
export const sceneNames = [
  'plans',
  'plan',
  'join',
  'cards',
  'membership',
  'upgradePrice',
  'tillBenefits',
  'scan',
  'useGuestPass',
  'recordPayment',
  'upgrade',
  'cancelToday',
  'tidyMembership',
] as const

// Build a client whose calls are recorded for the Behind the scenes drawer.
// The trace is required so no route can make an unrecorded Ophelio call.
export function connect(apiKey: string, trace: TraceCall[], base?: typeof fetch): Ophelio {
  return new Ophelio({ apiKey, fetch: tracedFetch(apiKey, trace, base) })
}

// A fetch wrapper that records every Ophelio request and response.
export function tracedFetch(
  apiKey: string,
  trace: TraceCall[],
  base: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const url = new URL(request.url)
    const path = redact(url.pathname, apiKey)
    const entry: TraceCall = {
      name: callName(request.method, path, url.searchParams, trace),
      request: `${request.method} ${path}`,
    }
    trace?.push(entry)
    try {
      const response = await base(input, init)
      entry.response = redactValue(await jsonBody(response), apiKey)
      return response
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      entry.response = { error: redact(message, apiKey) }
      throw error
    }
  }
}

async function jsonBody(response: Response): Promise<unknown> {
  try {
    return await response.clone().json()
  } catch {
    return undefined
  }
}

// The drawer names each call after the function in src/ophelio.ts that makes it.
// A plan's prices and benefits are named after the plan read that came before
// them: `plans` after the list, `plan` after a single-plan read. The upgrade
// lookup reads a plan's links and then the linked plan, all as `upgradePrice`.
function callName(
  method: string,
  path: string,
  query: URLSearchParams,
  trace: TraceCall[],
): string {
  const route = `${method} ${path}`
  if (route === 'GET /api/v1/plans' || route === 'GET /api/v1/target-codes') return 'plans'
  if (/^GET \/api\/v1\/plans\/[^/]+\/(billing-options|entitlements)$/.test(route)) {
    const read = [...(trace ?? [])]
      .reverse()
      .find((call) => /^GET \/api\/v1\/plans(\/[^/]+)?$/.test(call.request ?? ''))
    return read?.name ?? 'plans'
  }
  if (/^GET \/api\/v1\/plans\/[^/]+\/plan-links$/.test(route)) return 'upgradePrice'
  if (/^GET \/api\/v1\/plans\/[^/]+$/.test(route)) {
    return trace?.at(-1)?.name === 'upgradePrice' ? 'upgradePrice' : 'plan'
  }
  if (route === 'POST /api/v1/memberships') return 'join'
  if (/^GET \/api\/v1\/memberships\/[^/]+\/members$/.test(route)) return 'cards'
  if (/^GET \/api\/v1\/memberships\/[^/]+$/.test(route)) return 'membership'
  if (/^GET \/api\/v1\/members\/[^/]+\/entitlements$/.test(route)) {
    return query.has('targets') ? 'tillBenefits' : 'cards'
  }
  if (route === 'GET /api/v1/admit') return 'scan'
  if (route === 'POST /api/v1/entitlements/redeem') return 'useGuestPass'
  if (/^POST \/api\/v1\/memberships\/[^/]+\/transactions$/.test(route)) return 'recordPayment'
  if (/^POST \/api\/v1\/memberships\/[^/]+\/upgrade$/.test(route)) return 'upgrade'
  if (/^POST \/api\/v1\/memberships\/[^/]+\/cancel$/.test(route)) return 'cancelToday'
  if (/^DELETE \/api\/v1\/(members|customers)\/[^/]+$/.test(route)) return 'tidyMembership'
  return 'ophelio'
}

// The API key never reaches the browser, so keep it out of the recorded text.
function redact(text: string, apiKey: string): string {
  return apiKey ? text.split(apiKey).join('[redacted]') : text
}

function redactValue(value: unknown, apiKey: string): unknown {
  if (typeof value === 'string') return redact(value, apiKey)
  if (Array.isArray(value)) return value.map((item) => redactValue(item, apiKey))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactValue(item, apiKey)]),
    )
  }
  return value
}
