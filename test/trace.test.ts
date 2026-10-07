import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { createMockKv } from './mock-kv.js'

vi.mock('../src/trace.js', () => ({
  sceneNames: [],
  connect: vi.fn((_apiKey: string, trace?: { name: string; request?: string }[]) => {
    trace?.push({ name: 'join', request: 'POST /api/v1/memberships' })
    return {}
  }),
}))

vi.mock('../src/ophelio.js', () => ({
  plan: vi.fn(async () => ({
    plan: {
      id: 'plan_1',
      code: 'individual',
      display_name: 'Individual',
      description: 'One adult',
      max_party_size: 1,
      status: 'active',
    },
    prices: [
      {
        id: 'price_1',
        plan_id: 'plan_1',
        unit_amount: 9500,
        currency: 'USD',
        frequency_unit: 'year',
        frequency_interval: 1,
        is_recurring: true,
        display_name: 'Yearly',
        description: null,
        status: 'active',
        payment_method_type: 'card',
        dunning_max_retries: 1,
        dunning_keep_entitlements: false,
        create_time: '',
        update_time: '',
      },
    ],
    benefits: [],
  })),
  join: vi.fn(async () => 'membership_1'),
  cards: vi.fn(async () => ({
    membership: {
      id: 'membership_1',
      status: 'active',
      billing_option_id: 'price_1',
      customer_id: null,
      end_time: null,
      current_term: null,
    },
    cards: [
      {
        person: { id: 'member_1', name: 'Alex Cove', card_id: 'TIDE-1', is_primary: true },
        benefits: [],
      },
    ],
  })),
}))

const source = readFileSync(new URL('../src/index.tsx', import.meta.url), 'utf8')
const mockKv = createMockKv()

async function fetchApp(request: Request) {
  const { default: app } = await import('../src/index.tsx')
  return app.fetch(request, {
    OPHELIO_API_KEY: 'test_key',
    COOKIE_SECRET: 'a-secret-that-is-long-enough-for-hmac-sha256-signing',
    VISITORS: mockKv,
  })
}

describe('untraced Ophelio calls', () => {
  it('creates every Ophelio client with a trace', () => {
    const args = [...source.matchAll(/connect\(([^)]*)\)/g)].map((match) => match[1])
    expect(args.length).toBeGreaterThan(0)
    for (const value of args) {
      expect(value).toMatch(/trace/)
    }
  })

  it('only builds an Ophelio client inside the trace wrapper', () => {
    const srcDir = new URL('../src/', import.meta.url)
    const files = readdirSync(srcDir, { recursive: true, encoding: 'utf8' }).filter((file) =>
      /\.tsx?$/.test(file),
    )
    const offenders = files.filter(
      (file) =>
        file.replaceAll('\\', '/') !== 'trace.ts' &&
        /new\s+Ophelio\s*\(/.test(readFileSync(new URL(file, srcDir), 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})

describe('calls before a redirect', () => {
  it('travel to the next page so the drawer still shows them', async () => {
    const joinResponse = await fetchApp(
      new Request('http://localhost/join', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'cf-connecting-ip': '10.9.0.1',
        },
        body: new URLSearchParams({ plan: 'plan_1', name_0: 'Alex Cove', role_0: 'adult' }),
      }),
    )
    expect(joinResponse.status).toBe(302)
    expect(joinResponse.headers.get('location')).toBe('/cards')

    const pending = await mockKv.list({ prefix: 'pending-trace:' })
    expect(pending.keys).toHaveLength(1)
    expect(await mockKv.get(pending.keys[0].name)).toContain('POST /api/v1/memberships')

    const cookie = (joinResponse.headers.get('set-cookie') as string).split(';')[0]
    const cardsResponse = await fetchApp(
      new Request('http://localhost/cards', { headers: { cookie } }),
    )
    expect(cardsResponse.status).toBe(200)
    expect(await cardsResponse.text()).toContain('POST /api/v1/memberships')

    const after = await mockKv.list({ prefix: 'pending-trace:' })
    expect(after.keys).toHaveLength(0)
  })
})
