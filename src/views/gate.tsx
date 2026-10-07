import type { AdmitResult } from '@ophelio/sdk'
import type { CastCard } from '../cast.js'

const gates = [
  { code: 'main_entrance', label: 'Main entrance' },
  { code: 'jelly_drift', label: 'Jelly Drift' },
  { code: 'keeper_tour', label: 'Keeper tour' },
]

export function reasonText(result: AdmitResult): string {
  if (result.admitted) return 'Welcome'
  switch (result.deny_reason) {
    case 'card_not_found':
      return 'Not today — this card is not recognised. It may have been replaced.'
    case 'free_entry_not_granted':
      return 'Not today — this plan does not include entry here.'
    case 'free_entry_unavailable':
      if (result.membership_status === 'grace_period' || result.membership_status === 'past_due') {
        return 'Not today — the membership payment needs attention. Please see the front desk.'
      }
      return 'Not today — this plan does not include entry here.'
    case 'member_removed':
      return 'Not today — this member has been removed.'
    case 'membership_cancelled':
      return 'Not today — this membership has been cancelled.'
    case 'membership_expired':
      return 'Not today — this membership has expired.'
    case 'membership_incomplete':
      return 'Not today — this membership is incomplete.'
    case 'payment_overdue':
      return 'Not today — the membership payment is overdue.'
    default:
      return 'Not today'
  }
}

export function GatePage({
  gate,
  result,
  ownCards,
  cast,
}: {
  gate: string
  result?: AdmitResult
  ownCards: { card: string; name: string }[]
  cast: CastCard[]
}) {
  const headline = result ? reasonText(result) : 'Tap a card to scan'
  const tone = result?.admitted ? 'success' : result ? 'danger' : ''
  return (
    <div class="page gate-page">
      <section class="section">
        <div class="wrap narrow">
          <p class="eyebrow">Gate</p>
          <h1>{headline}</h1>

          <form method="post" action="/gate" class="gate-form">
            <label class="gate-label">Where are you standing?</label>
            <div class="gate-places">
              {gates.map((place) => (
                <label class={`gate-place ${place.code === gate ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="gate"
                    value={place.code}
                    checked={place.code === gate}
                  />
                  {place.label}
                </label>
              ))}
            </div>

            {result ? (
              <div class={`gate-result gate-result-${tone}`}>
                <div class="gate-result-icon">{result.admitted ? '✓' : '✕'}</div>
                <div class="gate-result-body">
                  <strong>{result.admitted ? 'Admitted' : 'Not admitted'}</strong>
                  <span class="gate-result-plan">{result.plan ?? 'Unknown plan'}</span>
                  {result.actions.length > 0 ? (
                    <span class="gate-result-action">
                      {result.actions[0].type.replace(/_/g, ' ')}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div class="scanner-section">
              <h2>Your cards</h2>
              {ownCards.length === 0 ? (
                <p class="empty">
                  You have not joined yet. <a href="/join">Join first</a>.
                </p>
              ) : (
                <div class="scanner-cards">
                  {ownCards.map((card) => (
                    <button type="submit" name="card" value={card.card} class="scanner-card">
                      <span class="scanner-card-name">{card.name}</span>
                      <code>{card.card}</code>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div class="scanner-section">
              <h2>Demo cast</h2>
              {cast.length === 0 ? (
                <p class="empty">Our sample members are not here today. Please check back soon.</p>
              ) : (
                <div class="scanner-cards">
                  {cast.map((member) => (
                    <button
                      type="submit"
                      name="card"
                      value={member.card}
                      class="scanner-card scanner-card-cast"
                    >
                      <span class="scanner-card-name">{member.label}</span>
                      <code>{member.card}</code>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
