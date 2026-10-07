import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { serve } from '@hono/node-server'
import { createMockKv } from '../test/mock-kv.js'
import app from '../src/index.tsx'

const originalFetch = globalThis.fetch

const memberships = new Map<
  string,
  { status: string; billing_option_id: string; plan_code: string }
>()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const planFixtures = {
  individual: {
    id: 'plan_individual',
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
  family: {
    id: 'plan_family',
    code: 'family',
    display_name: 'Family',
    description: 'Two adults and children',
    max_party_size: 6,
    grace_period_duration: 7,
    grace_period_unit: 'day',
    status: 'active',
    create_time: '',
    update_time: '',
  },
  patron: {
    id: 'plan_patron',
    code: 'patron',
    display_name: 'Patron',
    description: 'Family plus keeper tours',
    max_party_size: 6,
    grace_period_duration: 7,
    grace_period_unit: 'day',
    status: 'active',
    create_time: '',
    update_time: '',
  },
  cafe_club: {
    id: 'plan_cafe_club',
    code: 'cafe_club',
    display_name: 'Café Club',
    description: 'Discounts only',
    max_party_size: 1,
    grace_period_duration: 7,
    grace_period_unit: 'day',
    status: 'active',
    create_time: '',
    update_time: '',
  },
}

const priceFixtures: Record<
  string,
  {
    id: string
    plan_id: string
    unit_amount: number
    currency: string
    frequency_unit: string
    frequency_interval: number
    is_recurring: boolean
    display_name: string
    description: null
    status: string
    payment_method_type: string
    dunning_max_retries: number
    dunning_keep_entitlements: boolean
    create_time: string
    update_time: string
  }
> = {
  price_individual: {
    id: 'price_individual',
    plan_id: 'plan_individual',
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
  price_family: {
    id: 'price_family',
    plan_id: 'plan_family',
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
  price_patron: {
    id: 'price_patron',
    plan_id: 'plan_patron',
    unit_amount: 36000,
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
  price_cafe_club: {
    id: 'price_cafe_club',
    plan_id: 'plan_cafe_club',
    unit_amount: 2500,
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
}

const memberForPlan: Record<
  string,
  { id: string; name: string; card_id: string; role_code: string }
> = {
  plan_individual: {
    id: 'member_individual',
    name: 'Alex Cove',
    card_id: 'TIDE-IND-1',
    role_code: 'adult',
  },
  plan_family: { id: 'member_family', name: 'Sam Cove', card_id: 'TIDE-FAM-1', role_code: 'adult' },
  plan_patron: {
    id: 'member_patron',
    name: 'Amelia Drift',
    card_id: 'TIDE-PAT-1',
    role_code: 'adult',
  },
  plan_cafe_club: {
    id: 'member_cafe',
    name: 'Taylor Tide',
    card_id: 'TIDE-CAFE-1',
    role_code: 'adult',
  },
}

function readJsonBody(init?: RequestInit): unknown {
  if (!init?.body) return {}
  if (typeof init.body === 'string') return JSON.parse(init.body)
  return {}
}

function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init)
  const url = new URL(request.url)
  const path = url.pathname
  const query = url.searchParams

  if (path === '/api/v1/target-codes') {
    const place = (code: string, display_name: string) => ({ id: code, code, display_name })
    return Promise.resolve(
      json({
        next_page_token: '',
        total_size: 5,
        target_codes: [
          place('main_entrance', 'Main entrance'),
          place('jelly_drift', 'Jelly Drift'),
          place('keeper_tour', 'Keeper tour'),
          place('tidal_cafe', 'Tidal Café'),
          place('gift_shop', 'Gift shop'),
        ],
      }),
    )
  }

  if (path === '/api/v1/plans') {
    return Promise.resolve(
      json({ next_page_token: '', total_size: 4, plans: Object.values(planFixtures) }),
    )
  }

  if (path.startsWith('/api/v1/plans/') && path.endsWith('/plan-links')) {
    const planId = path.split('/')[4]
    const plan = Object.values(planFixtures).find((p) => p.id === planId)
    const next =
      plan?.code === 'individual'
        ? planFixtures.family
        : plan?.code === 'family'
          ? planFixtures.patron
          : undefined
    return Promise.resolve(
      json({
        next_page_token: '',
        total_size: next ? 1 : 0,
        plan_links: next
          ? [
              {
                id: 'link_1',
                type: 'upgrade',
                plan: { id: next.id, code: next.code, display_name: next.display_name },
                require_interval_match: false,
                create_time: '',
                update_time: '',
              },
            ]
          : [],
      }),
    )
  }

  if (
    path.startsWith('/api/v1/plans/') &&
    !path.endsWith('/billing-options') &&
    !path.endsWith('/entitlements') &&
    !path.endsWith('/plan-links')
  ) {
    const planId = path.split('/')[4]
    const plan = Object.values(planFixtures).find((p) => p.id === planId)
    if (plan) return Promise.resolve(json(plan))
  }

  if (path.startsWith('/api/v1/plans/') && path.endsWith('/billing-options')) {
    const planId = path.split('/')[4]
    const plan = Object.values(planFixtures).find((p) => p.id === planId)
    const price = plan ? Object.values(priceFixtures).find((p) => p.plan_id === plan.id) : undefined
    return Promise.resolve(
      json({
        next_page_token: '',
        total_size: price ? 1 : 0,
        billing_options: price ? [price] : [],
      }),
    )
  }

  if (path.startsWith('/api/v1/plans/') && path.endsWith('/entitlements')) {
    return Promise.resolve(json({ next_page_token: '', total_size: 0, entitlements: [] }))
  }

  if (path === '/api/v1/memberships' && request.method === 'POST') {
    return request
      .clone()
      .json()
      .then((body) => {
        const typedBody = body as { billing_option_id: string }
        const id = `membership_${Date.now()}`
        const price = Object.values(priceFixtures).find((p) => p.id === typedBody.billing_option_id)
        const planCode = price
          ? (Object.values(planFixtures).find((p) => p.id === price.plan_id)?.code ?? 'individual')
          : 'individual'
        memberships.set(id, {
          status: 'active',
          billing_option_id: typedBody.billing_option_id,
          plan_code: planCode,
        })
        return json({
          id,
          status: 'active',
          billing_option_id: typedBody.billing_option_id,
          customer_id: null,
          start_time: new Date().toISOString(),
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
        })
      })
  }

  if (path.startsWith('/api/v1/memberships/') && path.endsWith('/members')) {
    const membershipId = path.split('/')[4]
    const membership = memberships.get(membershipId)
    const plan = membership
      ? Object.values(planFixtures).find((p) => p.code === membership.plan_code)
      : undefined
    const member = plan ? memberForPlan[plan.id] : memberForPlan.plan_individual
    return Promise.resolve(
      json({
        next_page_token: '',
        total_size: 1,
        members: [
          {
            id: member.id,
            membership_id: membershipId,
            customer_id: null,
            role_id: 'role_1',
            name: member.name,
            date_of_birth: null,
            is_primary: true,
            card_id: member.card_id,
            card_issued_time: null,
            removed_time: null,
            create_time: '',
            update_time: '',
            role: null,
            membership: null,
          },
        ],
      }),
    )
  }

  if (
    path.startsWith('/api/v1/memberships/') &&
    path.split('/').length === 5 &&
    !path.endsWith('/transactions') &&
    !path.endsWith('/upgrade') &&
    !path.endsWith('/cancel') &&
    !path.endsWith('/members')
  ) {
    const id = path.split('/')[4]
    const membership = memberships.get(id) ?? {
      status: 'active',
      billing_option_id: 'price_individual',
      plan_code: 'individual',
    }
    return Promise.resolve(
      json({
        id,
        status: membership.status,
        billing_option_id: membership.billing_option_id,
        customer_id: null,
        start_time: '',
        end_time: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
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
        current_term: {
          id: 'term_1',
          membership_id: id,
          billing_option_id: membership.billing_option_id,
          term_start: '',
          term_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          closed_time: null,
          renewal_notified_time: null,
          create_time: '',
          update_time: '',
          plan: planFixtures[membership.plan_code as keyof typeof planFixtures],
          billing_option: priceFixtures[membership.billing_option_id as keyof typeof priceFixtures],
        },
      }),
    )
  }

  if (path.endsWith('/transactions')) {
    const id = path.split('/')[4]
    const body = readJsonBody(init) as { status?: string }
    memberships.set(id, {
      ...(memberships.get(id) ?? {
        billing_option_id: 'price_individual',
        plan_code: 'individual',
      }),
      status: body.status === 'failed' ? 'past_due' : 'active',
    })
    return Promise.resolve(
      json({
        id: 'txn_1',
        type: 'payment',
        status: body.status,
        amount_cents: 9500,
        currency: 'USD',
      }),
    )
  }

  if (path.endsWith('/upgrade')) {
    const id = path.split('/')[4]
    const body = readJsonBody(init) as { new_billing_option_id?: string }
    const newPriceId = body.new_billing_option_id ?? 'price_family'
    memberships.set(id, { status: 'active', billing_option_id: newPriceId, plan_code: 'family' })
    return Promise.resolve(
      json({
        id: 'change_1',
        type: 'upgrade',
        status: 'applied',
        effective_time: '',
        new_billing_option_id: newPriceId,
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
    )
  }

  if (path.endsWith('/cancel')) {
    const id = path.split('/')[4]
    memberships.set(id, {
      ...(memberships.get(id) ?? {
        billing_option_id: 'price_individual',
        plan_code: 'individual',
      }),
      status: 'cancelled',
    })
    return Promise.resolve(json({ id, status: 'cancelled' }))
  }

  if (path.startsWith('/api/v1/members/') && path.endsWith('/entitlements')) {
    return Promise.resolve(
      json({
        next_page_token: '',
        total_size: 2,
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
          },
        ],
      }),
    )
  }

  if (path === '/api/v1/entitlements/redeem') {
    return Promise.resolve(
      json({
        redeemed: {},
        usage_id: 'u_1',
        remaining_quota: 3,
        used_time: new Date().toISOString(),
      }),
    )
  }

  if (path === '/api/v1/admit') {
    const card = query.get('card') ?? ''
    const allowed = Object.values(memberForPlan).map((m) => m.card_id)
    const member = Object.values(memberForPlan).find((m) => m.card_id === card)
    const admitted = allowed.includes(card) && !card.startsWith('TIDE-CAFE')
    return Promise.resolve(
      json({
        admitted,
        deny_reason: admitted ? null : 'free_entry_not_granted',
        member: member
          ? {
              id: member.id,
              name: member.name,
              card_id: member.card_id,
              card_issued_time: null,
              role_code: member.role_code,
            }
          : null,
        membership_id: 'membership_demo',
        membership_status: 'active',
        plan: 'Demo',
        pricing_group: 'member_adult',
        entitlements: [],
        actions: [],
        target_context_applied: true,
      }),
    )
  }

  return originalFetch(input, init)
}

globalThis.fetch = mockFetch as typeof fetch

const kv = createMockKv()

const env = {
  OPHELIO_API_KEY: 'dummy_key_for_preview_only',
  COOKIE_SECRET: 'a-secret-that-is-long-enough-for-hmac-sha256-signing',
  VISITORS: kv,
}

const publicDir = resolve('public')

serve(
  {
    fetch: async (request) => {
      const url = new URL(request.url)
      const filePath = resolve(publicDir, url.pathname.slice(1) || 'index.html')
      if (existsSync(filePath) && !filePath.startsWith(publicDir + '/.')) {
        const content = readFileSync(filePath)
        const contentType = filePath.endsWith('.css')
          ? 'text/css'
          : filePath.endsWith('.svg')
            ? 'image/svg+xml'
            : filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')
              ? 'image/jpeg'
              : 'application/octet-stream'
        return new Response(content, { headers: { 'content-type': contentType } })
      }
      return app.fetch(request, env)
    },
    port: 3000,
  },
  (info) => {
    console.log(`Preview server running at http://localhost:${info.port}`)
  },
)
