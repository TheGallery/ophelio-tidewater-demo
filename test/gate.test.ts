import { describe, it, expect } from 'vitest'
import type { AdmitResult } from '@ophelio/sdk'
import { reasonText } from '../src/views/gate.js'

function denied(membershipStatus: string): AdmitResult {
  return {
    admitted: false,
    deny_reason: 'free_entry_unavailable',
    member: {
      id: 'member_1',
      name: 'Jordan Cove',
      card_id: 'TIDE-CAST-1',
      card_issued_time: null,
      role_code: 'adult',
    },
    membership_id: 'membership_1',
    membership_status: membershipStatus,
    plan: 'Family',
    pricing_group: 'member_adult',
    entitlements: [],
    actions: [],
    target_context_applied: true,
  } as unknown as AdmitResult
}

describe('gate refusal for free_entry_unavailable', () => {
  it('says the plan does not include entry for an active membership at an uncovered place', () => {
    expect(reasonText(denied('active'))).toBe('Not today — this plan does not include entry here.')
  })

  it.each(['grace_period', 'past_due'])('points a %s membership to the front desk', (status) => {
    expect(reasonText(denied(status))).toBe(
      'Not today — the membership payment needs attention. Please see the front desk.',
    )
  })
})
