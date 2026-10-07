import qrcode from 'qrcode-generator'
import type { MemberEntitlement } from '@ophelio/sdk'

export function QRCode({ text }: { text: string }) {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const svg = qr.createSvgTag({ cellSize: 3, margin: 0 })
  return <div class="qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    active: 'success',
    cancelled: 'danger',
    expired: 'danger',
    past_due: 'warning',
    grace_period: 'warning',
    incomplete: 'muted',
  }
  return <span class={`badge badge-${tone[status] ?? 'muted'}`}>{status.replace(/_/g, ' ')}</span>
}

const placeNames: Record<string, string> = {
  main_entrance: 'Main entrance',
  jelly_drift: 'Jelly Drift',
  keeper_tour: 'Keeper tour',
  tidal_cafe: 'Tidal Café',
  gift_shop: 'Gift shop',
}

function places(codes: string[]): string {
  return codes.map((code) => placeNames[code] ?? code.replace(/_/g, ' ')).join(', ')
}

function benefitWords(benefit: MemberEntitlement): string {
  switch (benefit.type) {
    case 'free_entry':
      return `Free entry: ${benefit.valid_at ? places(benefit.valid_at) : 'anywhere'}`
    case 'guest_pass':
      return `Guest passes: ${benefit.quota_limit} a ${benefit.quota_period}`
    case 'discount':
      return `${benefit.discount_percentage}% off: ${benefit.valid_at ? places(benefit.valid_at) : 'everywhere'}`
    case 'early_access':
      return `Early access: ${benefit.valid_on?.map((window) => window.days_of_week.join(', ')).join('; ') ?? 'selected dates'}`
    default:
      return benefit.display_name
  }
}

export function BenefitList({ benefits }: { benefits: MemberEntitlement[] }) {
  if (benefits.length === 0) return <p class="empty">No benefits on this card.</p>
  return (
    <ul class="benefit-list">
      {benefits.map((benefit) => (
        <li>{benefitWords(benefit)}</li>
      ))}
    </ul>
  )
}

export function PriceTag({
  price,
}: {
  price: {
    unit_amount: number
    currency: string
    frequency_unit: string
    frequency_interval: number
  }
}) {
  const amount = (price.unit_amount / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: price.currency,
  })
  const suffix = price.frequency_unit === 'year' ? '/year' : `/${price.frequency_unit}`
  return (
    <span class="price">
      <span class="price-amount">{amount}</span>
      <span class="price-suffix">{suffix}</span>
    </span>
  )
}
