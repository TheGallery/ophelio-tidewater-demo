import type { Membership, Member, MemberEntitlement } from '@ophelio/sdk'
import { QRCode, StatusBadge, BenefitList } from './components.js'

function expiryText(membership: Membership): string {
  const raw = membership.end_time ?? membership.current_term?.term_end
  if (!raw) return 'renews yearly'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return 'renews yearly'
  return date.toLocaleDateString('en-GB', { month: '2-digit', year: '2-digit' })
}

export function CardsPage({
  membership,
  cards,
}: {
  membership: Membership
  cards: { person: Member; benefits: MemberEntitlement[] }[]
}) {
  const expiry = expiryText(membership)
  return (
    <div class="page">
      <section class="section">
        <div class="wrap narrow">
          <p class="eyebrow">Your cards</p>
          <h1>Member cards</h1>
          <p class="lead">
            Your membership cards. Show one at the gate, or use it in the café and gift shop.
          </p>

          <div class="membership-status">
            <span>Membership status</span>
            <StatusBadge status={membership.status} />
          </div>

          <div class="card-list">
            {cards.map(({ person, benefits }) => (
              <div class="phone-card">
                <div class="phone-card-header">
                  <img class="mark" src="/tidewater-mark.svg" alt="" />
                  <span>Tidewater Aquarium</span>
                  <span class="card-demo">Demo</span>
                </div>
                <div class="phone-card-body">
                  <QRCode text={person.card_id ?? ''} />
                  <code class="card-id">{person.card_id}</code>
                  <strong class="card-holder">{person.name}</strong>
                  <span class="card-expiry">Valid thru {expiry}</span>
                  {person.is_primary ? <span class="badge badge-primary">Primary</span> : null}
                </div>
                <div class="phone-card-footer">
                  <BenefitList benefits={benefits} />
                </div>
              </div>
            ))}
          </div>

          <div class="actions-row">
            <a class="button" href="/gate">
              Scan at the gate
            </a>
            <a class="button button-ghost" href="/till">
              Use at the till
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
