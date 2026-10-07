import type { Plan, BillingOption } from '@ophelio/sdk'
import { PriceTag } from './components.js'

// A made-up expiry a few years ahead, so the pretend card looks plausible.
function cardExpiry(): string {
  const year = (new Date().getFullYear() + 3) % 100
  return `12/${String(year).padStart(2, '0')}`
}

export function JoinPage({
  plan,
  price,
  people,
  turnstileSiteKey,
}: {
  plan: Plan
  price: BillingOption
  people: { name: string; role: 'adult' | 'child' }[]
  turnstileSiteKey?: string
}) {
  const lead = people[0]?.name ?? 'Tidewater Member'
  const expiry = cardExpiry()
  return (
    <div class="page">
      <section class="section">
        <div class="wrap narrow">
          <p class="eyebrow">Join</p>
          <h1>Become a member</h1>
          <p class="lead">
            Join in one step. This is a demo sign-up, so there are no card details to enter and the
            family names are made up.
          </p>

          <form method="post" action="/join" class="join-form">
            <input type="hidden" name="plan" value={plan.id} />

            <div class="plan-pill">
              <strong>{plan.display_name}</strong>
              <PriceTag price={price} />
            </div>

            <div class="family-block">
              <div class="family-header">
                <h2>Your made-up family</h2>
                <a class="button button-small button-ghost" href={`/join?plan=${plan.id}`}>
                  Shuffle names
                </a>
              </div>
              <ul class="family-list">
                {people.map((person, index) => (
                  <li>
                    <input type="hidden" name={`name_${index}`} value={person.name} />
                    <input type="hidden" name={`role_${index}`} value={person.role} />
                    <span class="family-name">{person.name}</span>
                    <span class="badge badge-muted">{person.role}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div class="payment-box">
              <h3>Pretend payment</h3>
              <p class="muted">
                This is a demo payment. No card is charged and no card details are taken.
              </p>
              <div class="card-visual" aria-hidden="true">
                <div class="card-visual-top">
                  <span class="card-chip"></span>
                  <span class="card-network">TW</span>
                </div>
                <span class="card-number">4242 4242 4242 4242</span>
                <div class="card-visual-bottom">
                  <span class="card-visual-name">{lead}</span>
                  <span class="card-visual-expiry">Valid thru {expiry}</span>
                </div>
              </div>
            </div>

            {turnstileSiteKey ? (
              <div class="cf-turnstile" data-sitekey={turnstileSiteKey} data-theme="light"></div>
            ) : null}

            <button type="submit" class="button button-primary button-full">
              Activate membership
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
