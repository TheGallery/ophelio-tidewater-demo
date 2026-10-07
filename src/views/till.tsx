import type { MemberEntitlement } from '@ophelio/sdk'
import { StatusBadge } from './components.js'

export function TillPage({
  membershipStatus,
  memberId,
  memberName,
  benefits,
  guestPassesLeft,
}: {
  membershipStatus: string
  memberId: string
  memberName: string
  benefits: MemberEntitlement[]
  guestPassesLeft?: number
}) {
  const discount = benefits.find((b) => b.type === 'discount')
  const guestPass = benefits.find((b) => b.type === 'guest_pass')
  return (
    <div class="page">
      <section class="section">
        <div class="wrap narrow">
          <p class="eyebrow">Till</p>
          <h1>Tidal Café & Gift shop</h1>
          <p class="lead">
            Show your card in the café or gift shop to get your member discount, and bring a guest
            along with a guest pass.
          </p>

          <div class="membership-status">
            <span>{memberName}</span>
            <StatusBadge status={membershipStatus} />
          </div>

          <div class="till-grid">
            <div class="till-tile">
              <h2>Member discount</h2>
              {discount ? (
                <div class="till-big">{discount.discount_percentage}% off</div>
              ) : (
                <p class="empty">No discount here.</p>
              )}
            </div>

            <div class="till-tile">
              <h2>Guest passes</h2>
              {guestPass ? (
                <div>
                  <div class="till-big">
                    {guestPassesLeft !== undefined
                      ? `${guestPassesLeft} left`
                      : `${guestPass.quota_limit} a ${guestPass.quota_period}`}
                  </div>
                  <form method="post" action="/till">
                    <input type="hidden" name="member_id" value={memberId} />
                    <button type="submit" class="button button-accent button-full">
                      Use a guest pass
                    </button>
                  </form>
                  {guestPassesLeft !== undefined ? (
                    <p class="fine-print">{guestPassesLeft} remaining after the last use.</p>
                  ) : null}
                </div>
              ) : (
                <p class="empty">This plan does not include guest passes.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
