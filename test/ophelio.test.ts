import { describe, it, expect } from 'vitest'
import {
  plans,
  plan,
  join,
  cards,
  scan,
  tillBenefits,
  useGuestPass,
  paymentFailed,
  membership,
  upgradePrice,
  upgrade,
  cancelToday,
} from '../src/ophelio.js'
import { connect, tracedFetch } from '../src/trace.js'
import type { BillingOption } from '@ophelio/sdk'
import type { TraceCall } from '../src/types.js'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function fakeFetch(
  handlers: Record<string, (request: Request) => Response | Promise<Response>>,
): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init)
    const key = `${request.method} ${new URL(request.url).pathname}`
    const handler = handlers[key]
    if (!handler) throw new Error(`Unexpected request: ${key}`)
    return handler(request)
  }
}

const price: BillingOption = {
  id: 'price_1',
  plan_id: 'plan_1',
  unit_amount: 9500,
  currency: 'USD',
  frequency_unit: 'year',
  frequency_interval: 1,
  is_recurring: true,
  display_name: 'Individual yearly',
  description: null,
  status: 'active',
  payment_method_type: 'card',
  dunning_max_retries: 1,
  dunning_keep_entitlements: false,
  create_time: '2026-01-01T00:00:00Z',
  update_time: '2026-01-01T00:00:00Z',
}

describe('plans', () => {
  it('lists active plans with prices and benefits', async () => {
    const trace: TraceCall[] = []
    const ophelio = connect(
      'test_key',
      trace,
      fakeFetch({
        'GET /api/v1/plans': () =>
          jsonResponse({
            next_page_token: '',
            total_size: 1,
            plans: [
              {
                id: 'plan_1',
                code: 'individual',
                display_name: 'Individual',
                description: 'One adult',
                max_party_size: 1,
                grace_period_duration: 7,
                grace_period_unit: 'day',
                status: 'active',
                create_time: '',
                update_time: '',
              },
            ],
          }),
        'GET /api/v1/plans/plan_1/billing-options': () =>
          jsonResponse({ next_page_token: '', total_size: 1, billing_options: [price] }),
        'GET /api/v1/target-codes': () =>
          jsonResponse({
            next_page_token: '',
            total_size: 1,
            target_codes: [{ id: 't1', code: 'jelly_drift', display_name: 'Jelly Drift' }],
          }),
        'GET /api/v1/plans/plan_1/entitlements': () =>
          jsonResponse({
            next_page_token: '',
            total_size: 1,
            entitlements: [
              {
                id: 'pe1',
                entitlement: { type: 'free_entry' },
                availabilities: [{ targets: ['jelly_drift', 'main_entrance'] }],
              },
            ],
          }),
      }),
    )
    const result = await plans(ophelio)
    expect(result[0].benefits[0].availabilities[0].targets).toEqual([
      'Jelly Drift',
      'Main entrance',
    ])
    expect(result).toHaveLength(1)
    expect(result[0].plan.code).toBe('individual')
    expect(result[0].prices[0].id).toBe('price_1')
    expect(trace).toHaveLength(4)
    expect(trace.every((call) => call.name === 'plans')).toBe(true)
  })
})

describe('plan', () => {
  it('reads one plan with its prices and benefits', async () => {
    const trace: TraceCall[] = []
    const ophelio = connect(
      'test_key',
      trace,
      fakeFetch({
        'GET /api/v1/plans/plan_1': () =>
          jsonResponse({
            id: 'plan_1',
            code: 'individual',
            display_name: 'Individual',
            description: 'One adult',
            max_party_size: 1,
            grace_period_duration: 7,
            grace_period_unit: 'day',
            status: 'active',
            create_time: '',
            update_time: '',
          }),
        'GET /api/v1/plans/plan_1/billing-options': () =>
          jsonResponse({ next_page_token: '', total_size: 1, billing_options: [price] }),
        'GET /api/v1/plans/plan_1/entitlements': () =>
          jsonResponse({ next_page_token: '', total_size: 0, entitlements: [] }),
      }),
    )
    const result = await plan(ophelio, 'plan_1')
    expect(result.plan.id).toBe('plan_1')
    expect(result.prices[0].id).toBe('price_1')
    expect(trace.map((call) => call.name)).toEqual(['plan', 'plan', 'plan'])
  })
})

describe('the trace wrapper', () => {
  it('records the request and response and blanks the API key', async () => {
    const trace: TraceCall[] = []
    const recorded = tracedFetch('secret_key', trace, async () =>
      jsonResponse({ path: '/api/v1/plans', key: 'secret_key' }),
    )
    await recorded('https://api.ophelio.test/api/v1/plans')
    expect(trace).toHaveLength(1)
    expect(trace[0].request).toBe('GET /api/v1/plans')
    expect(trace[0].response).toEqual({ path: '/api/v1/plans', key: '[redacted]' })
  })

  it('records a failed call with its error', async () => {
    const trace: TraceCall[] = []
    const recorded = tracedFetch('secret_key', trace, async () => {
      throw new Error('network down')
    })
    await expect(recorded('https://api.ophelio.test/api/v1/plans')).rejects.toThrow('network down')
    expect(trace[0].response).toEqual({ error: 'network down' })
  })
})

describe('join', () => {
  it('creates a membership with made-up dates and currency', async () => {
    let requestBody: unknown
    const trace: TraceCall[] = []
    const ophelio = connect(
      'test_key',
      trace,
      fakeFetch({
        'POST /api/v1/memberships': async (request) => {
          requestBody = await request.clone().json()
          return jsonResponse({ id: 'membership_1' })
        },
      }),
    )
    const membershipId = await join(
      ophelio,
      price,
      [{ name: 'Alex Cove', role: 'adult' }],
      'visitor@example.com',
    )
    expect(membershipId).toBe('membership_1')
    const body = requestBody as {
      transaction?: { currency?: string }
      members?: { date_of_birth?: string; email?: string }[]
    }
    expect(body.transaction?.currency).toBe('USD')
    expect(body.members?.[0].email).toMatch(/@example\.com$/)
    expect(body.members?.[0].date_of_birth).toBe('1980-01-01')
    expect(trace[0].name).toBe('join')
  })

  it('gives every person an email of their own, based on the visitor email', async () => {
    let requestBody: unknown
    const ophelio = connect(
      'test_key',
      [],
      fakeFetch({
        'POST /api/v1/memberships': async (request) => {
          requestBody = await request.clone().json()
          return jsonResponse({ id: 'membership_1' })
        },
      }),
    )
    await join(
      ophelio,
      price,
      [
        { name: 'Taylor Tide', role: 'adult' },
        { name: 'Kai Tide', role: 'child' },
      ],
      'morgan.harding.123@example.com',
    )
    const body = requestBody as { members: { email: string }[] }
    expect(body.members.map((member) => member.email)).toEqual([
      'morgan.harding.123.0@example.com',
      'morgan.harding.123.1@example.com',
    ])
  })
})

describe('cards', () => {
  it('returns membership, people and benefits', async () => {
    const trace: TraceCall[] = []
    const ophelio = connect(
      'test_key',
      trace,
      fakeFetch({
        'GET /api/v1/memberships/membership_1': () =>
          jsonResponse({
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
          }),
        'GET /api/v1/memberships/membership_1/members': () =>
          jsonResponse({
            next_page_token: '',
            total_size: 1,
            members: [
              {
                id: 'member_1',
                membership_id: 'membership_1',
                customer_id: null,
                role_id: 'role_1',
                name: 'Alex Cove',
                date_of_birth: null,
                is_primary: true,
                card_id: 'TIDE-1234',
                card_issued_time: null,
                removed_time: null,
                create_time: '',
                update_time: '',
                role: null,
                membership: null,
              },
            ],
          }),
        'GET /api/v1/members/member_1/entitlements': () =>
          jsonResponse({ next_page_token: '', total_size: 0, entitlements: [] }),
      }),
    )
    const result = await cards(ophelio, 'membership_1')
    expect(result.membership.id).toBe('membership_1')
    expect(result.cards[0].person.name).toBe('Alex Cove')
    expect(trace.map((call) => call.name)).toEqual(['membership', 'cards', 'cards'])
  })
})

describe('scan', () => {
  it('checks a card at a gate', async () => {
    const trace: TraceCall[] = []
    const ophelio = connect(
      'test_key',
      trace,
      fakeFetch({
        'GET /api/v1/admit': () =>
          jsonResponse({
            admitted: true,
            deny_reason: null,
            member: {
              id: 'member_1',
              name: 'Alex Cove',
              card_id: 'TIDE-1234',
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
          }),
      }),
    )
    const result = await scan(ophelio, 'TIDE-1234', 'main_entrance')
    expect(result.admitted).toBe(true)
    expect(trace[0].name).toBe('scan')
  })
})

describe('tillBenefits', () => {
  it('lists entitlements filtered by the café target', async () => {
    const trace: TraceCall[] = []
    const ophelio = connect(
      'test_key',
      trace,
      fakeFetch({
        'GET /api/v1/members/member_1/entitlements': () =>
          jsonResponse({
            next_page_token: '',
            total_size: 1,
            entitlements: [
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
                valid_at: ['tidal_cafe', 'gift_shop'],
              },
            ],
          }),
      }),
    )
    const result = await tillBenefits(ophelio, 'member_1')
    expect(result[0].discount_percentage).toBe(10)
    expect(trace[0].name).toBe('tillBenefits')
  })
})

describe('useGuestPass', () => {
  it('redeems a guest pass', async () => {
    const trace: TraceCall[] = []
    const ophelio = connect(
      'test_key',
      trace,
      fakeFetch({
        'POST /api/v1/entitlements/redeem': () =>
          jsonResponse({
            redeemed: {},
            usage_id: 'usage_1',
            remaining_quota: 3,
            used_time: '2026-01-01T00:00:00Z',
          }),
      }),
    )
    const result = await useGuestPass(ophelio, 'member_1')
    expect(result.remaining_quota).toBe(3)
    expect(trace[0].name).toBe('useGuestPass')
  })
})

describe('paymentFailed', () => {
  it('records a failed payment with currency', async () => {
    const trace: TraceCall[] = []
    const ophelio = connect(
      'test_key',
      trace,
      fakeFetch({
        'POST /api/v1/memberships/membership_1/transactions': () =>
          jsonResponse({
            id: 'txn_1',
            type: 'payment',
            status: 'failed',
            amount_cents: 9500,
            currency: 'USD',
          }),
      }),
    )
    const result = await paymentFailed(ophelio, 'membership_1', price)
    expect(result.status).toBe('failed')
    expect(trace[0].name).toBe('recordPayment')
  })
})

describe('upgradePrice', () => {
  it('reads the upgrade price and names its calls upgradePrice', async () => {
    const trace: TraceCall[] = []
    const ophelio = connect(
      'test_key',
      trace,
      fakeFetch({
        'GET /api/v1/memberships/membership_1': () =>
          jsonResponse({ id: 'membership_1', current_term: { plan: { id: 'plan_1' } } }),
        'GET /api/v1/plans/plan_1/plan-links': () =>
          jsonResponse({
            next_page_token: '',
            total_size: 1,
            plan_links: [{ id: 'link_1', type: 'upgrade', plan: { id: 'plan_2', code: 'family' } }],
          }),
        'GET /api/v1/plans/plan_2': () => jsonResponse({ id: 'plan_2', status: 'active' }),
        'GET /api/v1/plans/plan_2/billing-options': () =>
          jsonResponse({
            next_page_token: '',
            total_size: 1,
            billing_options: [{ ...price, id: 'price_2', plan_id: 'plan_2' }],
          }),
      }),
    )
    const result = await upgradePrice(ophelio, await membership(ophelio, 'membership_1'))
    expect(result?.id).toBe('price_2')
    expect(trace.map((call) => call.name)).toEqual([
      'membership',
      'upgradePrice',
      'upgradePrice',
      'upgradePrice',
    ])
  })
})

describe('upgrade', () => {
  it('upgrades a membership immediately', async () => {
    const trace: TraceCall[] = []
    const ophelio = connect(
      'test_key',
      trace,
      fakeFetch({
        'POST /api/v1/memberships/membership_1/upgrade': () =>
          jsonResponse({
            id: 'change_1',
            type: 'upgrade',
            status: 'applied',
            effective_time: '',
            new_billing_option_id: 'price_2',
            applied_term_id: null,
            failure_reason: null,
            superseded_by_id: null,
            note: null,
            created_by: null,
            source: 'api',
            members: [],
            create_time: '',
            apply_time: null,
          }),
      }),
    )
    const result = await upgrade(ophelio, 'membership_1', 'price_2')
    expect(result).toBeDefined()
    expect(trace.some((call) => call.name === 'upgrade')).toBe(true)
  })
})

describe('cancelToday', () => {
  it('cancels a membership immediately', async () => {
    const trace: TraceCall[] = []
    const ophelio = connect(
      'test_key',
      trace,
      fakeFetch({
        'POST /api/v1/memberships/membership_1/cancel': () =>
          jsonResponse({ id: 'membership_1', status: 'cancelled' }),
      }),
    )
    const result = await cancelToday(ophelio, 'membership_1')
    expect(result.status).toBe('cancelled')
    expect(trace[0].name).toBe('cancelToday')
  })
})
