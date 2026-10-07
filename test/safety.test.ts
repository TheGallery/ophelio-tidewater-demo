import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/trace.js', () => ({
  connect: vi.fn((_apiKey: string, trace?: { name: string; request?: string }[]) => {
    trace?.push({ name: 'plans', request: 'GET /api/v1/plans' })
    return {}
  }),
}))

vi.mock('../src/ophelio.js', () => ({
  plans: vi.fn(async () => {
    return [
      {
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
      },
      {
        plan: {
          id: 'plan_2',
          code: 'family',
          display_name: 'Family',
          description: 'Family',
          max_party_size: 6,
          status: 'active',
        },
        prices: [
          {
            id: 'price_2',
            plan_id: 'plan_2',
            unit_amount: 18000,
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
      },
    ]
  }),
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
      customer_id: 'cust_1',
      start_time: '',
      end_time: null,
      grace_until: null,
      auto_renew: true,
      current_term_id: null,
      cancellation_effective_time: null,
      cancellation_requested_time: null,
      cancellation_reason: null,
      sales_channel_id: null,
      create_time: '',
      update_time: '',
      customer: null,
      current_term: null,
    },
    cards: [
      {
        person: {
          id: 'member_1',
          membership_id: 'membership_1',
          customer_id: null,
          role_id: 'role_1',
          name: 'Alex Cove',
          date_of_birth: null,
          is_primary: true,
          card_id: 'TIDE-OWN-1',
          card_issued_time: null,
          removed_time: null,
          create_time: '',
          update_time: '',
          role: null,
          membership: null,
        },
        benefits: [],
      },
    ],
  })),
  scan: vi.fn(async () => ({
    admitted: true,
    deny_reason: null,
    member: {
      id: 'member_1',
      name: 'Alex Cove',
      card_id: 'TIDE-OWN-1',
      card_issued_time: null,
      role_code: 'adult',
    },
    membership_id: 'membership_1',
    membership_status: 'active',
    plan: 'Individual',
    pricing_group: 'member_adult',
    entitlements: [],
    actions: [],
    target_context_applied: true,
  })),
  tillBenefits: vi.fn(async () => [
    {
      code: 'member_discount',
      type: 'discount',
      display_name: 'Member discount',
      plan_entitlement_id: 'pe_1',
      discount_percentage: 10,
      quota_limit: null,
      quota_period: 'year',
      requires_member_present: false,
      early_access_days: null,
      active_during_grace: false,
      valid_at: ['tidal_cafe'],
    },
  ]),
  useGuestPass: vi.fn(async () => ({
    redeemed: {},
    usage_id: 'u_1',
    remaining_quota: 3,
    used_time: '',
  })),
  paymentFailed: vi.fn(async () => ({})),
  paymentSucceeded: vi.fn(async () => ({})),
  upgrade: vi.fn(async () => ({})),
  cancelToday: vi.fn(async () => ({})),
  tidyMembership: vi.fn(async () => undefined),
  membership: vi.fn(async () => ({})),
}))

vi.mock('../src/cast.js', () => ({
  loadCast: vi.fn(async () => [
    {
      slug: 'patron',
      label: 'Patron',
      membershipId: 'cast_1',
      memberId: 'cast_member_1',
      card: 'TIDE-CAST-1',
    },
  ]),
}))

import { createMockKv } from './mock-kv.js'

const mockKv = createMockKv()

async function fetchApp(request: Request) {
  const { default: app } = await import('../src/index.tsx')
  const env = {
    OPHELIO_API_KEY: 'test_key',
    COOKIE_SECRET: 'a-secret-that-is-long-enough-for-hmac-sha256-signing',
    VISITORS: mockKv,
  }
  return app.fetch(request, env)
}

describe('cookie ownership', () => {
  it('redirects to join from cards when there is no cookie', async () => {
    const response = await fetchApp(new Request('http://localhost/cards'))
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/join')
  })

  it('sets a signed cookie after joining and then shows cards', async () => {
    const joinResponse = await fetchApp(
      new Request('http://localhost/join', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          plan: 'individual',
          visitor_email: 'v@example.com',
          name_0: 'Alex Cove',
          role_0: 'adult',
        }),
      }),
    )
    expect(joinResponse.status).toBe(302)
    expect(joinResponse.headers.get('location')).toBe('/cards')
    const cookie = joinResponse.headers.get('set-cookie')
    expect(cookie).toContain('tidewater_membership')

    const cardsResponse = await fetchApp(
      new Request('http://localhost/cards', { headers: { cookie: cookie as string } }),
    )
    expect(cardsResponse.status).toBe(200)
  })
})

describe('allowed cards at the gate', () => {
  it('rejects a card that is neither the visitors own nor in the cast', async () => {
    const joinResponse = await fetchApp(
      new Request('http://localhost/join', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          plan: 'individual',
          visitor_email: 'v@example.com',
          name_0: 'Alex Cove',
          role_0: 'adult',
        }),
      }),
    )
    const cookie = joinResponse.headers.get('set-cookie')

    const gateResponse = await fetchApp(
      new Request('http://localhost/gate', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookie as string },
        body: new URLSearchParams({ gate: 'main_entrance', card: 'TIDE-UNKNOWN' }),
      }),
    )
    expect(gateResponse.status).toBe(200)
    const text = await gateResponse.text()
    expect(text).toContain('That card is not allowed')
  })

  it('allows a cast card', async () => {
    const gateResponse = await fetchApp(
      new Request('http://localhost/gate', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ gate: 'keeper_tour', card: 'TIDE-CAST-1' }),
      }),
    )
    expect(gateResponse.status).toBe(200)
    const text = await gateResponse.text()
    expect(text).toContain('Welcome')
  })
})

describe('cast is read-only', () => {
  it('only acts on the membership from the signed cookie', async () => {
    const joinResponse = await fetchApp(
      new Request('http://localhost/join', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          plan: 'individual',
          visitor_email: 'v@example.com',
          name_0: 'Alex Cove',
          role_0: 'adult',
        }),
      }),
    )
    const cookie = joinResponse.headers.get('set-cookie')

    const response = await fetchApp(
      new Request('http://localhost/till', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookie as string },
        body: new URLSearchParams({ member_id: 'not_my_member' }),
      }),
    )
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('does not belong to your membership')
  })
})

describe('join only sends made-up people', () => {
  it('ignores a posted email and replaces real-looking names', async () => {
    const ophelio = await import('../src/ophelio.js')
    const join = vi.mocked(ophelio.join)
    join.mockClear()
    await fetchApp(
      new Request('http://localhost/join', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'cf-connecting-ip': '10.0.0.1',
        },
        body: new URLSearchParams({
          plan: 'family',
          visitor_email: 'someone@real.com',
          name_0: 'Jane Realperson',
          role_0: 'adult',
        }),
      }),
    )
    const [, , people, email] = join.mock.calls[0]
    expect(email).toMatch(/@example\.com$/)
    expect(people.map((person) => person.name)).not.toContain('Jane Realperson')
  })

  it('fits the family to a one-person plan', async () => {
    const ophelio = await import('../src/ophelio.js')
    const join = vi.mocked(ophelio.join)
    join.mockClear()
    await fetchApp(
      new Request('http://localhost/join', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'cf-connecting-ip': '10.0.0.2',
        },
        body: new URLSearchParams({
          plan: 'individual',
          name_0: 'Alex Cove',
          role_0: 'adult',
          name_1: 'Kai Cove',
          role_1: 'child',
        }),
      }),
    )
    const [, , people] = join.mock.calls[0]
    expect(people).toHaveLength(1)
    expect(people[0].role).toBe('adult')
  })
})

describe('rate-limit binding', () => {
  it('uses the Workers rate-limit binding when it is configured', async () => {
    const { default: app } = await import('../src/index.tsx')
    const limit = vi.fn(async () => ({ success: false }))
    const response = await app.fetch(
      new Request('http://localhost/plans', { headers: { 'cf-connecting-ip': '10.0.0.3' } }),
      {
        OPHELIO_API_KEY: 'test_key',
        COOKIE_SECRET: 'a-secret-that-is-long-enough-for-hmac-sha256-signing',
        VISITORS: mockKv,
        REQUEST_LIMITER: { limit },
      },
    )
    expect(response.status).toBe(429)
    expect(limit).toHaveBeenCalledWith({ key: 'default:10.0.0.3' })
  })
})

describe('guest passes', () => {
  it('shows the remaining quota from the redeem response', async () => {
    const joinResponse = await fetchApp(
      new Request('http://localhost/join', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'cf-connecting-ip': '10.0.0.4',
        },
        body: new URLSearchParams({ plan: 'individual', name_0: 'Alex Cove', role_0: 'adult' }),
      }),
    )
    const cookie = joinResponse.headers.get('set-cookie') as string
    const ophelio = await import('../src/ophelio.js')
    vi.mocked(ophelio.tillBenefits).mockResolvedValueOnce([
      {
        code: 'guest_pass',
        type: 'guest_pass',
        display_name: 'Guest pass',
        plan_entitlement_id: 'pe_2',
        discount_percentage: null,
        quota_limit: 4,
        quota_period: 'year',
        requires_member_present: false,
        early_access_days: null,
        active_during_grace: false,
        valid_at: [],
      },
    ] as never)
    const response = await fetchApp(
      new Request('http://localhost/till', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
        body: new URLSearchParams({ member_id: 'member_1' }),
      }),
    )
    const text = await response.text()
    expect(text).toContain('3 left')

    const passCookie = (response.headers.get('set-cookie') as string).split(';')[0]
    vi.mocked(ophelio.tillBenefits).mockResolvedValueOnce([
      {
        code: 'guest_pass',
        type: 'guest_pass',
        display_name: 'Guest pass',
        plan_entitlement_id: 'pe_2',
        discount_percentage: null,
        quota_limit: 4,
        quota_period: 'year',
        requires_member_present: false,
        early_access_days: null,
        active_during_grace: false,
        valid_at: [],
      },
    ] as never)
    const later = await fetchApp(
      new Request('http://localhost/till', {
        headers: { cookie: `${cookie.split(';')[0]}; ${passCookie}` },
      }),
    )
    expect(await later.text()).toContain('3 left')
  })
})

describe('every page', () => {
  it('renders in standards mode, says it is a demo and asks not to be indexed', async () => {
    const text = await (await fetchApp(new Request('http://localhost/'))).text()
    expect(text.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(text).toMatch(/<meta name="robots" content="noindex"\s*\/?>/)
    expect(text).toMatch(/<link rel="icon" href="\/tidewater-mark.svg"/)
    expect(text).toContain('Tidewater Aquarium is fictional.')
  })
})

describe('behind the scenes drawer', () => {
  it('is on pages that make no Ophelio calls', async () => {
    const text = await (await fetchApp(new Request('http://localhost/'))).text()
    expect(text).toContain('Behind the scenes')
    expect(text).toContain('This screen made no Ophelio calls')
  })

  it('marks plan calls served from cache', async () => {
    const headers = { 'cf-connecting-ip': '10.0.0.5' }
    await fetchApp(new Request('http://localhost/plans', { headers }))
    const text = await (await fetchApp(new Request('http://localhost/plans', { headers }))).text()
    expect(text).toContain('Served from cache')
  })
})

describe('tidy job', () => {
  it('keeps going after a failure and follows the KV cursor', async () => {
    const ophelio = await import('../src/ophelio.js')
    const tidy = vi.mocked(ophelio.tidyMembership)
    tidy.mockClear()
    tidy.mockRejectedValueOnce(new Error('busy'))
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const deleted: string[] = []
    const kv = {
      get: async () => old,
      delete: async (key: string) => {
        deleted.push(key)
      },
      list: async ({ cursor }: { cursor?: string }) =>
        cursor
          ? { keys: [{ name: 'visitors:m3' }], list_complete: true }
          : {
              keys: [{ name: 'visitors:m1' }, { name: 'visitors:m2' }],
              list_complete: false,
              cursor: 'next',
            },
    }
    const { scheduled } = await import('../src/index.tsx')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await scheduled({} as ScheduledController, { VISITORS: kv } as never, {} as ExecutionContext)
    error.mockRestore()
    expect(tidy).toHaveBeenCalledTimes(3)
    expect(deleted).toEqual(['visitors:m2', 'visitors:m3'])
  })
})
