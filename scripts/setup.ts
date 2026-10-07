import { Ophelio, OphelioError, collect } from '@ophelio/sdk'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const apiKey = process.env.OPHELIO_API_KEY
if (!apiKey) {
  console.error('Set OPHELIO_API_KEY in .dev.vars to an API key for your Ophelio project.')
  process.exit(1)
}

const ophelio = new Ophelio({ apiKey })

function readPreviousCast(): { slug: string; membershipId: string; card: string }[] {
  if (!existsSync('data/cast.json')) return []
  try {
    return JSON.parse(readFileSync('data/cast.json', 'utf8'))
  } catch {
    return []
  }
}

// Ophelio expires a membership once a billing option's dunning retries run out. With one retry a
// single failed payment expired it at once, so the past-due scene never showed. Three retries
// leave a first failure past due; the expired scene keeps failing payments until it expires.
const DUNNING_RETRIES = 3

const tally = { Created: 0, Reused: 0 }

function report(action: 'Created' | 'Reused', what: string) {
  tally[action] += 1
  console.log(`${action}: ${what}`)
}

async function findByCode<T extends { code: string }>(
  list: () => Promise<T[]>,
  code: string,
): Promise<T | undefined> {
  const all = await list()
  return all.find((item) => item.code === code)
}

async function getOrCreateTargetCode(code: string, displayName: string) {
  const existing = await findByCode(() => collect((page) => ophelio.targetCodes.list(page)), code)
  if (existing) {
    report('Reused', `place ${displayName}`)
    return existing
  }
  const created = await ophelio.targetCodes.create({ code, display_name: displayName })
  report('Created', `place ${displayName}`)
  return created
}

async function getOrCreateRole(code: string, displayName: string, minAge: number, maxAge: number) {
  const existing = await findByCode(() => collect((page) => ophelio.memberRoles.list(page)), code)
  if (existing) {
    report('Reused', `member role ${displayName}`)
    return existing
  }
  const created = await ophelio.memberRoles.create({
    code,
    display_name: displayName,
    min_age: minAge,
    max_age: maxAge,
    description: '',
  })
  report('Created', `member role ${displayName}`)
  return created
}

async function getOrCreatePricingGroup(code: string, displayName: string) {
  const existing = await findByCode(() => collect((page) => ophelio.pricingGroups.list(page)), code)
  if (existing) {
    report('Reused', `pricing group ${displayName}`)
    return existing
  }
  const created = await ophelio.pricingGroups.create({
    code,
    display_name: displayName,
    description: '',
  })
  report('Created', `pricing group ${displayName}`)
  return created
}

async function getOrCreateCalendar(code: string, displayName: string) {
  const existing = await findByCode(() => collect((page) => ophelio.calendars.list(page)), code)
  if (existing) {
    report('Reused', `calendar ${displayName}`)
    return existing
  }
  const created = await ophelio.calendars.create({
    code,
    display_name: displayName,
    description: '',
  })
  report('Created', `calendar ${displayName}`)
  return created
}

async function getOrCreateSalesChannel(code: string, displayName: string) {
  const existing = await findByCode(() => collect((page) => ophelio.salesChannels.list(page)), code)
  if (existing) {
    report('Reused', `sales channel ${displayName}`)
    return existing
  }
  const created = await ophelio.salesChannels.create({
    code,
    display_name: displayName,
    description: '',
    status: 'active',
  })
  report('Created', `sales channel ${displayName}`)
  return created
}

async function getOrCreateEntitlement(
  code: string,
  displayName: string,
  type: 'free_entry' | 'guest_pass' | 'discount' | 'early_access',
) {
  const existing = await findByCode(() => collect((page) => ophelio.entitlements.list(page)), code)
  if (existing) {
    report('Reused', `benefit ${displayName}`)
    return existing
  }
  const created = await ophelio.entitlements.create({
    code,
    display_name: displayName,
    type,
    description: '',
  })
  report('Created', `benefit ${displayName}`)
  return created
}

async function getOrCreatePlan(
  code: string,
  displayName: string,
  description: string,
  maxPartySize: number,
) {
  const existing = await findByCode(() => collect((page) => ophelio.plans.list(page)), code)
  if (existing) {
    report('Reused', `plan ${displayName}`)
    return existing
  }
  const created = await ophelio.plans.create({
    code,
    display_name: displayName,
    description,
    max_party_size: maxPartySize,
    grace_period_duration: 7,
    grace_period_unit: 'day',
    status: 'active',
  })
  report('Created', `plan ${displayName}`)
  return created
}

async function main() {
  const places = {
    main_entrance: await getOrCreateTargetCode('main_entrance', 'Main entrance'),
    jelly_drift: await getOrCreateTargetCode('jelly_drift', 'Jelly Drift'),
    keeper_tour: await getOrCreateTargetCode('keeper_tour', 'Keeper tour'),
    tidal_cafe: await getOrCreateTargetCode('tidal_cafe', 'Tidal Café'),
    gift_shop: await getOrCreateTargetCode('gift_shop', 'Gift shop'),
  }

  const adultRole = await getOrCreateRole('adult', 'Adult', 18, 999)
  const childRole = await getOrCreateRole('child', 'Child', 0, 17)

  const adultPrice = await getOrCreatePricingGroup('member_adult', 'Member adult')
  const childPrice = await getOrCreatePricingGroup('member_child', 'Member child')

  const weekendsCalendar = await getOrCreateCalendar('weekends', 'Weekends')
  const existingRules = await collect((page) =>
    ophelio.calendars.listRules(weekendsCalendar.id, page),
  )
  if (existingRules.length === 0) {
    await ophelio.calendars.createRule(weekendsCalendar.id, { days_of_week: [6, 7] })
    report('Created', 'Weekends calendar rule')
  } else {
    report('Reused', 'Weekends calendar rule')
  }

  const webChannel = await getOrCreateSalesChannel('web', 'Web')

  const memberEntry = await getOrCreateEntitlement('member_entry', 'Member admission', 'free_entry')
  const keeperTour = await getOrCreateEntitlement('keeper_tour', 'Keeper tour', 'free_entry')
  const guestPass = await getOrCreateEntitlement('guest_pass', 'Guest pass', 'guest_pass')
  const memberDiscount = await getOrCreateEntitlement(
    'member_discount',
    'Member discount',
    'discount',
  )
  const earlyAccess = await getOrCreateEntitlement('early_access', 'Early access', 'early_access')

  const individual = await getOrCreatePlan('individual', 'Individual', 'One adult', 1)
  const family = await getOrCreatePlan('family', 'Family', 'Two adults and up to four children', 6)
  const patron = await getOrCreatePlan('patron', 'Patron', 'Family plus keeper tours', 6)
  const cafeClub = await getOrCreatePlan(
    'cafe_club',
    'Café Club',
    'Discounts at the café and shop',
    1,
  )

  async function addPrice(planId: string, amountCents: number, name: string) {
    const existing = await collect((page) => ophelio.plans.listBillingOptions(planId, page))
    const sameAmount = existing.filter(
      (price) => price.unit_amount === amountCents && price.status === 'active',
    )
    const match = sameAmount.find((price) => price.dunning_max_retries === DUNNING_RETRIES)
    // A price's retries cannot be edited, so an older price with different retries is retired.
    const retireOld = async () => {
      for (const old of sameAmount) {
        if (old.id !== match?.id)
          await ophelio.billingOptions.update(old.id, { status: 'inactive' })
      }
    }
    if (match) {
      await retireOld()
      report('Reused', `price ${name}`)
      return match
    }
    const price = await ophelio.plans.createBillingOption(planId, {
      unit_amount: amountCents,
      frequency_unit: 'year',
      frequency_interval: 1,
      is_recurring: true,
      display_name: name,
      description: null,
      status: 'active',
      currency: 'USD',
      payment_method_type: 'card',
      dunning_max_retries: DUNNING_RETRIES,
      dunning_keep_entitlements: false,
    })
    await ophelio.billingOptions.createSalesChannelLink(price.id, {
      sales_channel_id: webChannel.id,
    })
    await retireOld()
    report('Created', `price ${name}`)
    return price
  }

  const individualPrice = await addPrice(individual.id, 9500, 'Individual yearly')
  const familyPrice = await addPrice(family.id, 18000, 'Family yearly')
  const patronPrice = await addPrice(patron.id, 36000, 'Patron yearly')
  const cafePrice = await addPrice(cafeClub.id, 2500, 'Café Club yearly')

  async function addMapping(planId: string, roleId: string, pricingGroupId: string) {
    const existing = await collect((page) => ophelio.plans.listPricingGroupMappings(planId, page))
    if (existing.some((mapping) => mapping.member_role_id === roleId)) {
      report('Reused', 'plan pricing mapping')
      return
    }
    await ophelio.plans.createPricingGroupMapping(planId, {
      member_role_id: roleId,
      pricing_group_id: pricingGroupId,
    })
    report('Created', 'plan pricing mapping')
  }

  await addMapping(individual.id, adultRole.id, adultPrice.id)
  await addMapping(family.id, adultRole.id, adultPrice.id)
  await addMapping(family.id, childRole.id, childPrice.id)
  await addMapping(patron.id, adultRole.id, adultPrice.id)
  await addMapping(patron.id, childRole.id, childPrice.id)
  await addMapping(cafeClub.id, adultRole.id, adultPrice.id)

  async function addEntitlement(
    planId: string,
    entitlementId: string,
    options: Partial<{
      quotaLimit: number
      quotaPeriod: 'day' | 'week' | 'month' | 'year'
      discountPercentage: number
      earlyAccessDays: number
      targets: string[]
      calendarId: string
    }>,
  ) {
    const existing = await collect((page) => ophelio.plans.listEntitlements(planId, page))
    const match = existing.find((item) => item.entitlement_id === entitlementId)
    if (match) {
      report('Reused', 'plan benefit')
      return match
    }
    const planEntitlement = await ophelio.plans.createEntitlement(planId, {
      entitlement_id: entitlementId,
      /* @ts-expect-error SDK types need updating */
      discount_percentage: options.discountPercentage || null,
      /* @ts-expect-error SDK types need updating */
      quota_limit: options.quotaLimit || null,
      quota_period: options.quotaPeriod ?? 'year',
      requires_member_present: false,
      early_access_days: options.earlyAccessDays ?? 0,
      active_during_grace: false,
    })
    if (options.targets?.length || options.calendarId) {
      await ophelio.planEntitlements.createAvailability(planEntitlement.id, {
        targets: options.targets ?? [],
        calendar_id: options.calendarId ?? null,
      })
    }
    report('Created', 'plan benefit')
    return planEntitlement
  }

  const entryTargets = [places.main_entrance.code, places.jelly_drift.code]
  const discountTargets = [places.tidal_cafe.code, places.gift_shop.code]

  for (const plan of [individual, family, patron]) {
    await addEntitlement(plan.id, memberEntry.id, { targets: entryTargets })
    await addEntitlement(plan.id, guestPass.id, {
      quotaLimit: plan.code === 'individual' ? 4 : 8,
      quotaPeriod: 'year',
    })
    await addEntitlement(plan.id, memberDiscount.id, {
      discountPercentage: 10,
      targets: discountTargets,
    })
    await addEntitlement(plan.id, earlyAccess.id, {
      earlyAccessDays: 3,
      calendarId: weekendsCalendar.id,
    })
  }
  await addEntitlement(patron.id, keeperTour.id, { targets: [places.keeper_tour.code] })
  await addEntitlement(cafeClub.id, memberDiscount.id, {
    discountPercentage: 10,
    targets: discountTargets,
  })

  async function linkUpgrades(lowerPlanId: string, higherPlanId: string) {
    const existing = await collect((page) => ophelio.plans.listPlanLinks(lowerPlanId, page))
    if (!existing.some((link) => link.plan.id === higherPlanId && link.type === 'upgrade')) {
      await ophelio.plans.createPlanLink(lowerPlanId, {
        target_plan_id: higherPlanId,
        type: 'upgrade',
        require_interval_match: false,
      })
      report('Created', 'upgrade path')
    } else {
      report('Reused', 'upgrade path')
    }
  }
  await linkUpgrades(individual.id, family.id)
  await linkUpgrades(family.id, patron.id)

  const previousCast = readPreviousCast()

  const fresh = (status: string) => status === 'active' || status === 'incomplete'

  async function failPayment(membershipId: string) {
    await ophelio.memberships.createTransaction(membershipId, {
      type: 'payment',
      status: 'failed',
      amount_cents: individualPrice.unit_amount,
      currency: 'USD',
      failure_reason: 'card_declined',
    })
  }

  async function createCastMembership(
    slug: string,
    label: string,
    planId: string,
    priceId: string,
    people: { name: string; role: string }[],
    prepare?: (state: {
      membershipId: string
      status: string
      members: { id: string; card_id: string | null; name: string }[]
      previousCard?: string
    }) => Promise<string | undefined>,
  ) {
    const existingMemberships = await collect((page) => ophelio.memberships.list(page))
    // A scene that should be past due must not reuse a membership that has since expired or
    // been cancelled, so only the expired scene accepts one.
    const found = existingMemberships.find(
      (membership) =>
        membership.customer?.email === `cast-${slug}@example.com` &&
        (slug === 'expired' || !['expired', 'cancelled'].includes(membership.status)),
    )
    const membership = found ?? (await createCast(slug, priceId, people))
    report(found ? 'Reused' : 'Created', `cast member ${label}`)
    const members = await collect((page) => ophelio.memberships.listMembers(membership.id, page))
    const previousCard = previousCast.find(
      (item) => item.slug === slug && item.membershipId === membership.id,
    )?.card
    const card = prepare
      ? await prepare({
          membershipId: membership.id,
          status: membership.status,
          members,
          previousCard,
        })
      : undefined
    return {
      slug,
      label,
      membershipId: membership.id,
      card: card ?? members[0]?.card_id ?? '',
      memberId: members[0]?.id ?? '',
    }
  }

  async function createCast(
    slug: string,
    priceId: string,
    people: { name: string; role: string }[],
  ) {
    return ophelio.memberships.create({
      billing_option_id: priceId,
      sales_channel: 'web',
      customer_name: people[0].name,
      customer_email: `cast-${slug}@example.com`,
      members: people.map((person, index) => ({
        name: person.name,
        role: person.role,
        is_primary: index === 0,
        date_of_birth: person.role === 'child' ? '2015-01-01' : '1980-01-01',
        email: `${person.name.split(' ').join('.').toLowerCase()}@example.com`,
      })),
      transaction: { amount_cents: 0, currency: 'USD' },
    })
  }

  const cast = []

  cast.push(
    await createCastMembership('patron', 'Patron — keeper tour', patron.id, patronPrice.id, [
      { name: 'Amelia Drift', role: 'adult' },
      { name: 'Kai Drift', role: 'child' },
    ]),
  )

  cast.push(
    await createCastMembership(
      'family_no_tour',
      'Family — no keeper tour',
      family.id,
      familyPrice.id,
      [
        { name: 'Sam Cove', role: 'adult' },
        { name: 'Jordan Cove', role: 'adult' },
        { name: 'Parker Cove', role: 'child' },
      ],
    ),
  )

  cast.push(
    await createCastMembership(
      'cafe_club',
      'Café Club — discounts only',
      cafeClub.id,
      cafePrice.id,
      [{ name: 'Taylor Tide', role: 'adult' }],
    ),
  )

  cast.push(
    await createCastMembership(
      'past_due',
      'Past due — Individual',
      individual.id,
      individualPrice.id,
      [{ name: 'Morgan Whelan', role: 'adult' }],
      async ({ membershipId, status }) => {
        if (fresh(status)) await failPayment(membershipId)
        const now = await ophelio.memberships.get(membershipId)
        if (now.status !== 'past_due' && now.status !== 'grace_period') {
          throw new Error(
            `Past due cast member is ${now.status}; expected past_due or grace_period`,
          )
        }
        return undefined
      },
    ),
  )

  cast.push(
    await createCastMembership(
      'expired',
      'Expired — Individual',
      individual.id,
      individualPrice.id,
      [{ name: 'Riley Salter', role: 'adult' }],
      async ({ membershipId, status }) => {
        // Keep failing payments until Ophelio runs out of retries and expires the membership.
        let current = status
        for (
          let attempt = 0;
          current !== 'expired' && attempt <= DUNNING_RETRIES + 1;
          attempt += 1
        ) {
          if (!fresh(current) && current !== 'past_due' && current !== 'grace_period') break
          await failPayment(membershipId)
          current = (await ophelio.memberships.get(membershipId)).status
        }
        if (current !== 'expired') {
          throw new Error(`Expired cast member is ${current}; expected expired`)
        }
        return undefined
      },
    ),
  )

  cast.push(
    await createCastMembership(
      'replaced',
      'Replaced card',
      family.id,
      familyPrice.id,
      [
        { name: 'Casey Harbor', role: 'adult' },
        { name: 'Quinn Harbor', role: 'child' },
      ],
      async ({ members, previousCard }) => {
        const current = members[0]
        if (previousCard && previousCard !== current?.card_id) return previousCard
        if (!current?.card_id) return undefined
        await ophelio.members.reissueCard(current.id)
        return current.card_id
      },
    ),
  )

  const castJson = JSON.stringify(cast, null, 2)
  mkdirSync('data', { recursive: true })
  writeFileSync('data/cast.json', castJson)
  report('Created', 'data/cast.json with the demo cast')

  const kvArgs = [
    'wrangler',
    'kv',
    'key',
    'put',
    '--binding',
    'VISITORS',
    'cast',
    '--path',
    'data/cast.json',
    '--remote',
  ]
  const kvCommand = `npx ${kvArgs.join(' ')}`
  console.log(`To make the cast available to the demo, run:`)
  console.log(`  ${kvCommand}`)

  let kvFailed = false
  if (process.env.CF_KV_DEPLOY === '1') {
    const result = spawnSync('npx', kvArgs, {
      stdio: 'inherit',
    })
    if (result.error || result.status !== 0) {
      console.error(`KV upload failed. Run this command manually:\n  ${kvCommand}`)
      process.exitCode = 1
      kvFailed = true
    }
  }

  console.log('')
  const plans = [individual, family, patron, cafeClub]
  const prices = [individualPrice, familyPrice, patronPrice, cafePrice]
  console.log(
    kvFailed
      ? 'Tidewater setup finished, but the cast could not be uploaded to KV.'
      : 'Tidewater setup complete.',
  )
  console.log(`  Steps: ${tally.Created} created, ${tally.Reused} reused`)
  console.log(`  Places: ${Object.keys(places).length}`)
  console.log(`  Plans: ${plans.length} (${plans.map((plan) => plan.display_name).join(', ')})`)
  console.log(`  Prices: ${prices.length}`)
  console.log(`  Cast memberships: ${cast.length}`)
  console.log('  Cast file: data/cast.json')
}

main().catch((error) => {
  console.error(error instanceof OphelioError ? `Setup stopped: ${error.message}` : error)
  process.exit(1)
})
