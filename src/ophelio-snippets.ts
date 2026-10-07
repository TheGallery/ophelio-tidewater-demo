export const snippets: Record<string, string> = {
  plans: `collect((page) => ophelio.plans.list(page))
collect((page) => ophelio.targetCodes.list(page))
const active = all.filter((plan) => plan.status === 'active')
collect((page) => ophelio.plans.listBillingOptions(plan.id, page))
collect((page) => ophelio.plans.listEntitlements(plan.id, page))
prices: prices.filter((price) => price.status === 'active'),`,

  plan: `ophelio.plans.get(planId)
if (found.status !== 'active') throw new NotFoundError('That plan does not exist.')
collect((page) => ophelio.plans.listBillingOptions(planId, page))
collect((page) => ophelio.plans.listEntitlements(planId, page))`,

  join: `ophelio.memberships.create({
  billing_option_id: price.id,
  sales_channel: 'web',
  customer_name: people[0].name,
  customer_email: visitorEmail,
  members: people.map((person, index) => ({
    ...person,
    is_primary: index === 0,
    date_of_birth: person.role === 'child' ? '2015-01-01' : '1980-01-01',
    email: visitorEmail.replace('@', \`.\${index}@\`),
  })),
  transaction: {
    amount_cents: price.unit_amount,
    currency: price.currency,
  },
})`,

  cards: `ophelio.memberships.get(membershipId)
collect((page) => ophelio.memberships.listMembers(membershipId, page))
collect((page) => ophelio.members.listEntitlements(person.id, page))`,

  membership: `ophelio.memberships.get(membershipId)`,

  upgradePrice: `collect((page) => ophelio.plans.listPlanLinks(planId, page))
const upgrade = links.find((link) => link.type === 'upgrade')
ophelio.plans.get(upgrade.plan.id)
collect((page) => ophelio.plans.listBillingOptions(upgrade.plan.id, page))
if (target.status !== 'active') return undefined
return prices.find((price) => price.status === 'active')`,

  tillBenefits: `collect((page) =>
  ophelio.members.listEntitlements(memberId, { ...page, targets: ['tidal_cafe'] }),
)`,

  scan: `ophelio.admit.check({ card, targets: [gate] })`,

  useGuestPass: `ophelio.entitlements.redeem({ member_id: memberId, entitlement_code: 'guest_pass' })`,

  recordPayment: `ophelio.memberships.createTransaction(membershipId, {
  type: 'payment',
  status,
  amount_cents: price.unit_amount,
  currency: price.currency,
  failure_reason: status === 'failed' ? 'card_declined' : undefined,
})`,

  upgrade: `ophelio.memberships.upgrade(membershipId, {
  new_billing_option_id: newPriceId,
  effective_type: 'immediate',
})`,

  cancelToday: `ophelio.memberships.cancel(membershipId, { effective_type: 'immediate' })`,

  tidyMembership: `ophelio.memberships.get(membershipId)
if (membership.status !== 'cancelled') {
  ophelio.memberships.cancel(membershipId, { effective_type: 'immediate' })
}
collect((page) => ophelio.memberships.listMembers(membershipId, page))
await ophelio.members.remove(person.id)
await ophelio.customers.delete(membership.customer_id)`,
}
