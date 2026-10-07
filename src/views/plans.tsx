import type { Plan, BillingOption, PlanEntitlement } from '@ophelio/sdk'
import { PriceTag } from './components.js'

function benefitLine(benefit: PlanEntitlement): string {
  switch (benefit.entitlement?.type) {
    case 'free_entry':
      return `Free entry at ${benefit.availabilities.map((a) => a.targets.join(', ')).join(' and ')}`
    case 'guest_pass':
      return `${benefit.quota_limit} guest passes a ${benefit.quota_period}`
    case 'discount':
      return `${benefit.discount_percentage}% off at ${benefit.availabilities.map((a) => a.targets.join(', ')).join(' and ')}`
    case 'early_access':
      return 'Early access on weekends'
    default:
      return benefit.entitlement?.display_name ?? 'Benefit'
  }
}

export function PlansPage({
  plans,
}: {
  plans: { plan: Plan; prices: BillingOption[]; benefits: PlanEntitlement[] }[]
}) {
  return (
    <div class="page">
      <section class="section">
        <div class="wrap">
          <p class="eyebrow">Memberships</p>
          <h1>Choose how to belong</h1>
          <p class="lead">
            A year of visits, member prices in the café and gift shop, and more. Choose the
            membership that fits the way you visit.
          </p>
          <div class="plan-grid">
            {plans.map(({ plan, prices, benefits }) => {
              const price = prices[0]
              return (
                <div class="plan-card">
                  <div class="plan-card-head">
                    <h3>{plan.display_name}</h3>
                    <p>{plan.description}</p>
                  </div>
                  <div class="plan-card-price">
                    {price ? (
                      <PriceTag price={price} />
                    ) : (
                      <span class="muted">No public price</span>
                    )}
                  </div>
                  <ul class="plan-card-benefits">
                    {benefits.map((benefit) => (
                      <li>{benefitLine(benefit)}</li>
                    ))}
                  </ul>
                  <a class="button button-primary button-full" href={`/join?plan=${plan.id}`}>
                    Choose {plan.display_name}
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
