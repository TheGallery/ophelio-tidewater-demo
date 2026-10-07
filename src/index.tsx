import { Hono, type Context } from 'hono'
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie'
import { raw } from 'hono/html'
import {
  InvalidArgumentError,
  NotFoundError,
  ResourceExhaustedError,
  type Ophelio,
  type RedeemEntitlementResponse,
} from '@ophelio/sdk'
import type { TraceCall, Env } from './types.js'
import * as ophelio from './ophelio.js'
import { connect } from './trace.js'
import { makeFamily, makeEmail, fitsPlan, type Person } from './names.js'
import { rateLimit, verifyTurnstile } from './limits.js'
import { loadCast } from './cast.js'
import { Layout } from './views/layout.js'
import type { JSX } from 'hono/jsx/jsx-runtime'
import { HomePage } from './views/home.js'
import { PlansPage } from './views/plans.js'
import { JoinPage } from './views/join.js'
import { CardsPage } from './views/cards.js'
import { GatePage } from './views/gate.js'
import { TillPage } from './views/till.js'
import { ChangesPage } from './views/changes.js'
import { ErrorPage } from './views/error.js'

declare module 'hono' {
  interface ContextVariableMap {
    trace: TraceCall[]
  }
}

type C = Context<{ Bindings: Env }>

const COOKIE = 'tidewater_membership'
const GUEST_PASS_COOKIE = 'tidewater_guest_passes'
const VISITOR_TTL_MS = 24 * 60 * 60 * 1000

const app = new Hono<{ Bindings: Env }>()

// Every Ophelio call is recorded. A page reached by redirect also shows the calls
// made to get there, which the previous request left in KV for a couple of minutes.
app.use(async (c, next) => {
  const trace: TraceCall[] = []
  if (c.req.method === 'GET' && c.env.VISITORS) {
    const membershipId = await getSignedCookie(c, c.env.COOKIE_SECRET, COOKIE)
    if (membershipId) {
      try {
        const pending = await c.env.VISITORS.get(`pending-trace:${membershipId}`)
        if (pending) {
          try {
            trace.push(...(JSON.parse(pending) as TraceCall[]))
          } catch {
            // ignore an unreadable pending trace
          }
          await c.env.VISITORS.delete(`pending-trace:${membershipId}`)
        }
      } catch (error) {
        console.error('Could not read the trace from the previous page', error)
      }
    }
  }
  c.set('trace', trace)
  await next()
})

async function stashTrace(c: C, membershipId: string) {
  if (!c.env.VISITORS) return
  try {
    await c.env.VISITORS.put(`pending-trace:${membershipId}`, JSON.stringify(c.get('trace')), {
      expirationTtl: 120,
    })
  } catch (error) {
    console.error('Could not keep the trace for the next page', error)
  }
}

let planCache: {
  data: Awaited<ReturnType<typeof ophelio.plans>>
  calls: TraceCall[]
  at: number
} | null = null
const PLAN_CACHE_MS = 5 * 60 * 1000

async function getPlans(env: Env, trace: TraceCall[]) {
  if (planCache && Date.now() - planCache.at < PLAN_CACHE_MS) {
    trace.push(...planCache.calls.map((call) => ({ ...call, cached: true })))
    return planCache.data
  }
  const before = trace.length
  const data = await ophelio.plans(connect(env.OPHELIO_API_KEY, trace))
  planCache = { data, calls: trace.slice(before), at: Date.now() }
  return data
}

async function getVisitorMembershipId(c: C): Promise<string | undefined> {
  const value = await getSignedCookie(c, c.env.COOKIE_SECRET, COOKIE)
  return value || undefined
}

async function getGuestPassesLeft(c: C, memberId: string): Promise<number | undefined> {
  const value = await getSignedCookie(c, c.env.COOKIE_SECRET, GUEST_PASS_COOKIE)
  if (!value) return undefined
  const [storedMemberId, left] = value.split(':')
  if (storedMemberId !== memberId) return undefined
  const count = Number(left)
  return Number.isInteger(count) && count >= 0 ? count : undefined
}

async function setGuestPassesLeft(c: C, memberId: string, left: number) {
  await setSignedCookie(c, GUEST_PASS_COOKIE, `${memberId}:${left}`, c.env.COOKIE_SECRET, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: VISITOR_TTL_MS / 1000,
  })
}

function forgetVisitor(c: C) {
  deleteCookie(c, COOKIE, { path: '/', secure: true })
  deleteCookie(c, GUEST_PASS_COOKIE, { path: '/', secure: true })
}

function membershipGone(c: C) {
  forgetVisitor(c)
  return render(
    c,
    <ErrorPage
      message="Your demo membership has been tidied away. Join again to get a new one."
      retry="/join"
    />,
    'Membership gone',
  )
}

function render(c: C, page: JSX.Element, title: string, turnstileSiteKey?: string) {
  return c.html(
    <>
      {raw('<!DOCTYPE html>')}
      <Layout
        title={title}
        path={new URL(c.req.url).pathname}
        trace={c.get('trace')}
        turnstileSiteKey={turnstileSiteKey}
      >
        {page}
      </Layout>
    </>,
  )
}

function handleApiError(c: C, error: unknown, retry = c.req.path) {
  console.error(error)
  const message =
    error instanceof ResourceExhaustedError
      ? 'We are very busy right now. Please wait a moment and try again.'
      : 'We could not load this right now. Please try again in a moment.'
  return render(c, <ErrorPage message={message} retry={retry} />, 'Error')
}

function handleVisitorError(c: C, error: unknown, retry?: string) {
  if (error instanceof NotFoundError) return membershipGone(c)
  return handleApiError(c, error, retry)
}

// Home
app.get('/', (c) => render(c, <HomePage />, 'Home'))

// Plans
app.get('/plans', async (c) => {
  const limited = await rateLimit(c)
  if (limited) return limited
  try {
    const plans = await getPlans(c.env, c.get('trace'))
    return render(c, <PlansPage plans={plans} />, 'Plans')
  } catch (error) {
    return handleApiError(c, error)
  }
})

// Join
app.get('/join', async (c) => {
  const limited = await rateLimit(c)
  if (limited) return limited

  const existing = await getVisitorMembershipId(c)
  if (existing) return c.redirect('/cards')

  const planId = c.req.query('plan')
  if (!planId) return c.redirect('/plans')

  try {
    const api = connect(c.env.OPHELIO_API_KEY, c.get('trace'))
    const planInfo = await ophelio.plan(api, planId)
    const price = planInfo.prices[0]
    if (!price)
      return render(
        c,
        <ErrorPage message={`${planInfo.plan.display_name} has no public price.`} />,
        'Error',
      )

    const people = makeFamily(planInfo.plan.max_party_size)
    return render(
      c,
      <JoinPage
        plan={planInfo.plan}
        price={price}
        people={people}
        turnstileSiteKey={c.env.TURNSTILE_SITE_KEY}
      />,
      'Join',
      c.env.TURNSTILE_SITE_KEY,
    )
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof InvalidArgumentError) {
      console.error(error)
      return c.redirect('/plans')
    }
    return handleApiError(c, error)
  }
})

app.post('/join', async (c) => {
  const limited = await rateLimit(c, 'join')
  if (limited) return limited

  const existing = await getVisitorMembershipId(c)
  if (existing) return c.redirect('/cards')

  const form = await c.req.parseBody()
  const planId = String(form.plan ?? '')
  const turnstileToken = String(form['cf-turnstile-response'] ?? '')

  let turnstileOk: boolean
  try {
    turnstileOk = await verifyTurnstile(turnstileToken || undefined, c.env.TURNSTILE_SECRET_KEY)
  } catch {
    return render(
      c,
      <ErrorPage
        message="We could not run the bot check just now. Please try again."
        retry={`/join?plan=${planId}`}
      />,
      'Error',
    )
  }
  if (!turnstileOk) {
    return render(
      c,
      <ErrorPage
        message="Please complete the bot check and try again."
        retry={`/join?plan=${planId}`}
      />,
      'Error',
    )
  }

  if (!planId) {
    return render(c, <ErrorPage message="Choose a plan first." retry="/plans" />, 'Error')
  }

  try {
    const api = connect(c.env.OPHELIO_API_KEY, c.get('trace'))
    const planInfo = await ophelio.plan(api, planId)
    const price = planInfo.prices[0]
    if (!price)
      return render(
        c,
        <ErrorPage message={`${planInfo.plan.display_name} has no public price.`} />,
        'Error',
      )

    const maxPartySize = planInfo.plan.max_party_size
    let people: Person[] = []
    for (let i = 0; i < Math.max(6, maxPartySize); i += 1) {
      const name = form[`name_${i}`]
      const role = form[`role_${i}`]
      if (typeof name === 'string' && typeof role === 'string') {
        people.push({ name, role: role === 'child' ? 'child' : 'adult' })
      }
    }
    if (!fitsPlan(people, maxPartySize)) {
      people = makeFamily(maxPartySize)
    }

    const membershipId = await ophelio.join(api, price, people, makeEmail())

    await setSignedCookie(c, COOKIE, membershipId, c.env.COOKIE_SECRET, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: VISITOR_TTL_MS / 1000,
    })

    if (c.env.VISITORS) {
      await c.env.VISITORS.put(`visitors:${membershipId}`, new Date().toISOString())
    }
    await stashTrace(c, membershipId)

    return c.redirect('/cards')
  } catch (error) {
    return handleApiError(c, error)
  }
})

// Cards
app.get('/cards', async (c) => {
  const limited = await rateLimit(c)
  if (limited) return limited

  const membershipId = await getVisitorMembershipId(c)
  if (!membershipId) return c.redirect('/join')

  try {
    const api = connect(c.env.OPHELIO_API_KEY, c.get('trace'))
    const data = await ophelio.cards(api, membershipId)
    if (data.cards.length === 0) return membershipGone(c)
    return render(c, <CardsPage membership={data.membership} cards={data.cards} />, 'Your cards')
  } catch (error) {
    return handleVisitorError(c, error)
  }
})

// Gate
async function getOwnCards(c: C): Promise<{ card: string; name: string }[]> {
  const membershipId = await getVisitorMembershipId(c)
  if (!membershipId) return []
  try {
    const api = connect(c.env.OPHELIO_API_KEY, c.get('trace'))
    const data = await ophelio.cards(api, membershipId)
    return data.cards
      .filter((item) => item.person.card_id)
      .map((item) => ({ card: item.person.card_id as string, name: item.person.name }))
  } catch {
    // ignore: visitor may have an invalid cookie
    return []
  }
}

app.get('/gate', async (c) => {
  const limited = await rateLimit(c)
  if (limited) return limited

  const gate = c.req.query('gate') ?? 'main_entrance'
  const ownCards = await getOwnCards(c)
  const cast = await loadCast(c.env.VISITORS)
  return render(c, <GatePage gate={gate} ownCards={ownCards} cast={cast} />, 'Gate')
})

app.post('/gate', async (c) => {
  const limited = await rateLimit(c)
  if (limited) return limited

  const form = await c.req.parseBody()
  const gate = String(form.gate ?? 'main_entrance')
  const card = String(form.card ?? '')

  const ownCards = await getOwnCards(c)
  const cast = await loadCast(c.env.VISITORS)
  const allowedCards = [...ownCards, ...cast].map((item) => item.card)

  if (!allowedCards.includes(card)) {
    return render(c, <ErrorPage message="That card is not allowed." retry="/gate" />, 'Error')
  }

  try {
    const api = connect(c.env.OPHELIO_API_KEY, c.get('trace'))
    const result = await ophelio.scan(api, card, gate)

    return render(
      c,
      <GatePage gate={gate} result={result} ownCards={ownCards} cast={cast} />,
      'Gate',
    )
  } catch (error) {
    return handleApiError(c, error)
  }
})

// Till
app.get('/till', async (c) => {
  const limited = await rateLimit(c)
  if (limited) return limited

  const membershipId = await getVisitorMembershipId(c)
  if (!membershipId) return c.redirect('/join')

  try {
    const api = connect(c.env.OPHELIO_API_KEY, c.get('trace'))
    const data = await ophelio.cards(api, membershipId)
    return await renderTill(c, api, data)
  } catch (error) {
    return handleVisitorError(c, error)
  }
})

async function renderTill(
  c: C,
  api: Ophelio,
  data: Awaited<ReturnType<typeof ophelio.cards>>,
  lastRedemption?: RedeemEntitlementResponse,
) {
  const primary = data.cards.find((item) => item.person.is_primary) ?? data.cards[0]
  if (!primary) return membershipGone(c)

  const benefits = await ophelio.tillBenefits(api, primary.person.id)
  const guestPassesLeft = lastRedemption
    ? lastRedemption.remaining_quota
    : await getGuestPassesLeft(c, primary.person.id)
  return render(
    c,
    <TillPage
      membershipStatus={data.membership.status}
      memberId={primary.person.id}
      memberName={primary.person.name}
      benefits={benefits}
      guestPassesLeft={guestPassesLeft}
    />,
    'Till',
  )
}

app.post('/till', async (c) => {
  const limited = await rateLimit(c)
  if (limited) return limited

  const membershipId = await getVisitorMembershipId(c)
  if (!membershipId) return c.redirect('/join')

  const form = await c.req.parseBody()
  const memberId = String(form.member_id ?? '')

  try {
    const api = connect(c.env.OPHELIO_API_KEY, c.get('trace'))
    const data = await ophelio.cards(api, membershipId)
    const memberIds = data.cards.map((item) => item.person.id)
    if (!memberIds.includes(memberId)) {
      return render(
        c,
        <ErrorPage message="That member does not belong to your membership." />,
        'Error',
      )
    }

    const redemption = await ophelio.useGuestPass(api, memberId)
    await setGuestPassesLeft(c, memberId, redemption.remaining_quota)
    return await renderTill(c, api, data, redemption)
  } catch (error) {
    return handleVisitorError(c, error)
  }
})

// Changes
app.get('/changes', async (c) => {
  const limited = await rateLimit(c)
  if (limited) return limited

  const membershipId = await getVisitorMembershipId(c)
  if (!membershipId) return c.redirect('/join')

  try {
    const api = connect(c.env.OPHELIO_API_KEY, c.get('trace'))
    const membership = await ophelio.membership(api, membershipId)
    const currentPrice = ophelio.currentPrice(membership)
    const upgradePrice = await ophelio.upgradePrice(api, membership)

    return render(
      c,
      <ChangesPage
        membership={membership}
        currentPrice={currentPrice}
        upgradePrice={upgradePrice}
      />,
      'Changes',
    )
  } catch (error) {
    return handleVisitorError(c, error)
  }
})

app.post('/changes/:action', async (c) => {
  const limited = await rateLimit(c)
  if (limited) return limited

  const membershipId = await getVisitorMembershipId(c)
  if (!membershipId) return c.redirect('/join')

  const action = c.req.param('action')
  const api = connect(c.env.OPHELIO_API_KEY, c.get('trace'))

  try {
    const membership = await ophelio.membership(api, membershipId)
    const currentPrice = ophelio.currentPrice(membership)
    const upgradePrice = await ophelio.upgradePrice(api, membership)

    if (action === 'fail') {
      if (!currentPrice) throw new Error('Current price not found')
      await ophelio.paymentFailed(api, membershipId, currentPrice)
    } else if (action === 'pay') {
      if (!currentPrice) throw new Error('Current price not found')
      await ophelio.paymentSucceeded(api, membershipId, currentPrice)
    } else if (action === 'upgrade') {
      if (!upgradePrice) throw new Error('No upgrade available')
      await ophelio.upgrade(api, membershipId, upgradePrice.id)
    } else if (action === 'cancel') {
      await ophelio.cancelToday(api, membershipId)
    } else {
      return render(c, <ErrorPage message="Unknown action." retry="/changes" />, 'Error')
    }

    await stashTrace(c, membershipId)
    return c.redirect('/gate')
  } catch (error) {
    return handleVisitorError(c, error, '/changes')
  }
})

// Logout
app.get('/logout', (c) => {
  forgetVisitor(c)
  return c.redirect('/')
})

// Scheduled tidy
async function tidyVisitors(env: Env) {
  if (!env.VISITORS) return
  const trace: TraceCall[] = []
  const api = connect(env.OPHELIO_API_KEY, trace)
  const cutoff = Date.now() - VISITOR_TTL_MS
  let cursor: string | undefined
  do {
    const list = await env.VISITORS.list({ prefix: 'visitors:', cursor })
    for (const key of list.keys) {
      const created = await env.VISITORS.get(key.name)
      if (!created) continue
      const createdTime = new Date(created).getTime()
      if (createdTime >= cutoff) continue
      const membershipId = key.name.replace('visitors:', '')
      try {
        await ophelio.tidyMembership(api, membershipId)
        await env.VISITORS.delete(key.name)
      } catch (error) {
        if (error instanceof NotFoundError) {
          await env.VISITORS.delete(key.name)
        } else {
          console.error(`Could not tidy ${membershipId}; will retry next run`, error)
        }
      }
    }
    cursor = list.list_complete ? undefined : list.cursor
  } while (cursor)
  if (trace.length > 0) {
    console.log(`Tidy run recorded ${trace.length} Ophelio calls.`)
  }
}

export const scheduled: ExportedHandlerScheduledHandler<Env> = async (_event, env) => {
  await tidyVisitors(env)
}

export default {
  fetch: app.fetch,
  scheduled,
}
