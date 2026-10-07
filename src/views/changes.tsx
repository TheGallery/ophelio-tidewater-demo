import type { Membership } from '@ophelio/sdk'
import { StatusBadge } from './components.js'

export function ChangesPage({
  membership,
  currentPrice,
  upgradePrice,
}: {
  membership: Membership
  currentPrice?: { id: string }
  upgradePrice?: { id: string; display_name: string }
}) {
  return (
    <div class="page">
      <section class="section">
        <div class="wrap narrow">
          <p class="eyebrow">Lifecycle</p>
          <h1>When things change</h1>
          <p class="lead">
            Life changes, and so can your membership. Make a change below, then see what it means at
            the gate.
          </p>

          <div class="membership-status">
            <span>Current status</span>
            <StatusBadge status={membership.status} />
          </div>

          <div class="change-grid">
            <form method="post" action="/changes/fail" class="change-card">
              <h3>A renewal payment fails</h3>
              <p class="muted">Your card is declined and the membership becomes past due.</p>
              <button
                type="submit"
                class="button button-danger button-full"
                disabled={!currentPrice}
              >
                Fail payment
              </button>
            </form>

            <form method="post" action="/changes/pay" class="change-card">
              <h3>The payment goes through</h3>
              <p class="muted">Your payment goes through and the membership is active again.</p>
              <button
                type="submit"
                class="button button-success button-full"
                disabled={!currentPrice}
              >
                Record payment
              </button>
            </form>

            <form method="post" action="/changes/upgrade" class="change-card">
              <h3>Upgrade to {upgradePrice ? upgradePrice.display_name : 'the next plan'}</h3>
              <p class="muted">Move to a bigger plan right away.</p>
              <button
                type="submit"
                class="button button-primary button-full"
                disabled={!upgradePrice}
              >
                Upgrade now
              </button>
            </form>

            <form method="post" action="/changes/cancel" class="change-card">
              <h3>Cancel today</h3>
              <p class="muted">End your membership today.</p>
              <button type="submit" class="button button-ghost button-full">
                Cancel membership
              </button>
            </form>
          </div>

          <div class="actions-row">
            <a class="button" href="/gate">
              Go to the gate
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
