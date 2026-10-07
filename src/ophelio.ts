import {
  collect,
  NotFoundError,
  type Ophelio,
  type BillingOption,
  type Membership,
  type PlanEntitlement,
} from '@ophelio/sdk'

// Visitors see the venue's place names, so swap each place code in a benefit's availability
// for the display name Ophelio holds for it. A code Ophelio does not know reads as plain words.
function withPlaceNames(benefits: PlanEntitlement[], names: Map<string, string>) {
  return benefits.map((benefit) => ({
    ...benefit,
    availabilities: benefit.availabilities.map((availability) => ({
      ...availability,
      targets: availability.targets.map(
        (code) => names.get(code) ?? code.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      ),
    })),
  }))
}

// Scene 1: the live plan list, with each plan's prices and benefits.
export async function plans(ophelio: Ophelio) {
  const [all, places] = await Promise.all([
    collect((page) => ophelio.plans.list(page)),
    collect((page) => ophelio.targetCodes.list(page)),
  ])
  const names = new Map(places.map((place) => [place.code, place.display_name]))
  const active = all.filter((plan) => plan.status === 'active')
  return Promise.all(
    active.map(async (plan) => {
      const [prices, benefits] = await Promise.all([
        collect((page) => ophelio.plans.listBillingOptions(plan.id, page)),
        collect((page) => ophelio.plans.listEntitlements(plan.id, page)),
      ])
      return {
        plan,
        prices: prices.filter((price) => price.status === 'active'),
        benefits: withPlaceNames(benefits, names),
      }
    }),
  )
}

// Scene 1: one plan, with its prices and benefits.
export async function plan(ophelio: Ophelio, planId: string) {
  const found = await ophelio.plans.get(planId)
  if (found.status !== 'active') throw new NotFoundError('That plan does not exist.')
  const [prices, benefits] = await Promise.all([
    collect((page) => ophelio.plans.listBillingOptions(planId, page)),
    collect((page) => ophelio.plans.listEntitlements(planId, page)),
  ])
  return { plan: found, prices: prices.filter((price) => price.status === 'active'), benefits }
}

// Scene 2: one sign-up call for a made-up family and a pretend payment.
export async function join(
  ophelio: Ophelio,
  price: BillingOption,
  people: { name: string; role: 'adult' | 'child' }[],
  visitorEmail: string,
) {
  const membership = await ophelio.memberships.create({
    billing_option_id: price.id,
    sales_channel: 'web',
    customer_name: people[0].name,
    customer_email: visitorEmail,
    members: people.map((person, index) => ({
      ...person,
      is_primary: index === 0,
      // The SDK currently requires these fields even though the API does not.
      // Ophelio links people who share an email, so each person gets their own.
      date_of_birth: person.role === 'child' ? '2015-01-01' : '1980-01-01',
      email: visitorEmail.replace('@', `.${index}@`),
    })),
    transaction: {
      amount_cents: price.unit_amount,
      currency: price.currency,
    },
  })
  return membership.id
}

// Scene 3: the member's cards with their status and benefits.
export async function cards(ophelio: Ophelio, membershipId: string) {
  const membership = await ophelio.memberships.get(membershipId)
  const people = await collect((page) => ophelio.memberships.listMembers(membershipId, page))
  const cards = await Promise.all(
    people.map(async (person) => ({
      person,
      benefits: await collect((page) => ophelio.members.listEntitlements(person.id, page)),
    })),
  )
  return { membership, cards }
}

// Scene 6: a fresh look at the visitor's own membership.
export async function membership(ophelio: Ophelio, membershipId: string) {
  return ophelio.memberships.get(membershipId)
}

// Scene 6: the price the visitor is on now, taken from their current term.
export function currentPrice(membership: Membership) {
  return membership.current_term?.billing_option ?? undefined
}

// Scene 6: the next plan up and its price, read from the plan's upgrade link.
export async function upgradePrice(ophelio: Ophelio, membership: Membership) {
  const planId = membership.current_term?.plan?.id
  if (!planId) return undefined
  const links = await collect((page) => ophelio.plans.listPlanLinks(planId, page))
  const upgrade = links.find((link) => link.type === 'upgrade')
  if (!upgrade) return undefined
  const [target, prices] = await Promise.all([
    ophelio.plans.get(upgrade.plan.id),
    collect((page) => ophelio.plans.listBillingOptions(upgrade.plan.id, page)),
  ])
  if (target.status !== 'active') return undefined
  return prices.find((price) => price.status === 'active')
}

// Scene 4: check one card at one chosen place.
export async function scan(ophelio: Ophelio, card: string, gate: string) {
  return ophelio.admit.check({ card, targets: [gate] })
}

// Scene 5: the member's benefits that apply at the café.
export async function tillBenefits(ophelio: Ophelio, memberId: string) {
  return collect((page) =>
    ophelio.members.listEntitlements(memberId, { ...page, targets: ['tidal_cafe'] }),
  )
}

// Scene 5: spend one guest pass.
export async function useGuestPass(ophelio: Ophelio, memberId: string) {
  return ophelio.entitlements.redeem({ member_id: memberId, entitlement_code: 'guest_pass' })
}

// Scene 6: record a renewal payment that failed or went through.
async function recordPayment(
  ophelio: Ophelio,
  membershipId: string,
  price: { unit_amount: number; currency: string },
  status: 'succeeded' | 'failed',
) {
  return ophelio.memberships.createTransaction(membershipId, {
    type: 'payment',
    status,
    amount_cents: price.unit_amount,
    currency: price.currency,
    failure_reason: status === 'failed' ? 'card_declined' : undefined,
  })
}

export function paymentFailed(
  ophelio: Ophelio,
  membershipId: string,
  price: { unit_amount: number; currency: string },
) {
  return recordPayment(ophelio, membershipId, price, 'failed')
}

export function paymentSucceeded(
  ophelio: Ophelio,
  membershipId: string,
  price: { unit_amount: number; currency: string },
) {
  return recordPayment(ophelio, membershipId, price, 'succeeded')
}

// Scene 6: move up a plan straight away.
export async function upgrade(ophelio: Ophelio, membershipId: string, newPriceId: string) {
  return ophelio.memberships.upgrade(membershipId, {
    new_billing_option_id: newPriceId,
    effective_type: 'immediate',
  })
}

// Scene 6: cancel today rather than at the end of the term.
export async function cancelToday(ophelio: Ophelio, membershipId: string) {
  return ophelio.memberships.cancel(membershipId, { effective_type: 'immediate' })
}

// The hourly tidy cancels a visitor membership, removes its people and deletes the customer.
export async function tidyMembership(ophelio: Ophelio, membershipId: string) {
  const membership = await ophelio.memberships.get(membershipId)
  if (membership.status !== 'cancelled') {
    await ophelio.memberships.cancel(membershipId, { effective_type: 'immediate' })
  }
  const people = await collect((page) => ophelio.memberships.listMembers(membershipId, page))
  for (const person of people) {
    await ophelio.members.remove(person.id)
  }
  if (membership.customer_id) {
    await ophelio.customers.delete(membership.customer_id)
  }
}
