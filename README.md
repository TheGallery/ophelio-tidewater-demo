# Tidewater Aquarium — an Ophelio demo

A small, public demo of the [Ophelio](https://app.ophel.io) membership platform. It shows the same imaginary aquarium company across six short scenes: plans, join, member cards, gate, till and lifecycle changes. Every scene has a "Behind the scenes" drawer that shows the Ophelio call, the code and the response.

Live demo: https://ophelio-tidewater-demo.iopsychas.workers.dev

Built with **Hono** on **Cloudflare Workers**, server-rendered JSX, and almost no runtime dependencies.

## Run Tidewater against your own Ophelio project in five minutes

You need Node 22.12 or later and a Cloudflare account (sign in with `npx wrangler login`).

1. **Create the project** in the [Ophelio console](https://app.ophel.io). Choose your time zone and card prefix (`TIDE-` works well), and set the currency to US dollars: the setup script creates every price in USD.
2. **Create an API key** in that project and copy it.
3. Clone this repo and install dependencies:
   ```bash
   git clone https://github.com/TheGallery/ophelio-tidewater-demo.git
   cd ophelio-tidewater-demo
   npm install
   ```
4. Copy `.dev.vars.example` to `.dev.vars` and fill it in:
   ```bash
   cp .dev.vars.example .dev.vars
   # edit .dev.vars
   OPHELIO_API_KEY=o_live_...
   COOKIE_SECRET=a-long-random-string
   ```
   `openssl rand -base64 32` makes a good `COOKIE_SECRET`.
5. **Create the KV namespace**:
   ```bash
   npx wrangler kv namespace create VISITORS
   ```
   The `id` in `wrangler.jsonc` belongs to the hosted Tidewater demo. Replace it with the `id` this prints (wrangler offers to do it for you).
6. **Set up the Tidewater data** in your project and upload the cast:
   ```bash
   CF_KV_DEPLOY=1 npm run setup
   ```
   The script reads your key from `.dev.vars`. It creates the places, calendar, benefits, plans, prices, sales channel and the fixed cast of demo memberships, printing one line per item it creates or reuses and a summary at the end. It writes the cast to `data/cast.json` and uploads it to your KV namespace. Without `CF_KV_DEPLOY=1` it only prints the upload command.
7. Run locally:
   ```bash
   npm run dev
   ```
   `npm run dev` uses local KV, so the cast uploaded above is not visible there. To see it locally, also run `npx wrangler kv key put --binding VISITORS cast --path data/cast.json --local`.

   Joining on `npm run dev` creates real memberships in your Ophelio project. The hourly clean-up only runs on Cloudflare, so it never removes them.

To browse most of the demo without an Ophelio key, run `npm run preview`: it serves the site with mocked Ophelio data at http://localhost:3000.

## The six scenes and the Ophelio calls behind them

| Scene | Page | What you see | Function in `src/ophelio.ts` |
|---|---|---|---|
| 1 | `/plans`, `/join` | Live plans and prices | `plans`, `plan` |
| 2 | `/join` | Made-up family, pretend payment, one sign-up call | `join` |
| 3 | `/cards` | Phone-style cards with QR codes, status and benefits | `cards` |
| 4 | `/gate` | Choose a place, tap a card, get Welcome or Not today | `scan` |
| 5 | `/till` | Member discount and a guest-pass button | `tillBenefits`, `useGuestPass` |
| 6 | `/changes` | Fail a payment, record success, upgrade or cancel | `currentPrice`, `upgradePrice`, `paymentFailed`, `paymentSucceeded`, `upgrade`, `cancelToday` |

The calls come from the [`@ophelio/sdk`](https://www.npmjs.com/package/@ophelio/sdk) package, whose README lists them all.

The fixed cast gives you one card for every gate outcome: Patron admitted to the keeper tour, Family not admitted to the keeper tour, Café Club with no entry, past due, expired and a replaced card. Each yearly price allows three payment retries, so one failed payment leaves a member past due and the expired card keeps failing payments until Ophelio expires it. Run `npm run setup` again at any time: it reuses what is already there, replaces older prices that have a different retry count and replaces a past-due card that has already expired.

Every call is recorded in `src/trace.ts` with a small fetch wrapper around the Ophelio client. The drawer names each call after the function that makes it, shows the request, the response and the matching code, and blanks the API key. Calls made before a redirect, such as joining or changing a membership, travel with the visitor to the next page so the drawer still shows them.

## What's on purpose left out

- **Real payments** — Ophelio never handles money; the pretend payment step records a transaction.
- **Member log-in** — Ophelio has no public member sign-in. The demo uses a signed browser cookie to remember your one membership.
- **Ticket booking** — that belongs to the venue's own ticketing system.
- **Offline gate roster** — downloading a roster would expose every visitor's name.
- **Reciprocal entry** — Ophelio does not have reciprocal venues yet.
- **Webhook feed** — a good second-version addition, but needs a public receiver.

## Deployment

1. Set your secrets:
   ```bash
   npx wrangler secret put OPHELIO_API_KEY
   npx wrangler secret put COOKIE_SECRET
   ```
   Turnstile keys are recommended for any public deployment. Set both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` the same way, never just one, and the join form shows a challenge. With neither set, the check is skipped.
2. Deploy:
   ```bash
   npx wrangler deploy
   ```

Rate limits use the [Workers rate-limit bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) `REQUEST_LIMITER` (60 page views a minute) and `JOIN_LIMITER` (one join a minute) in `wrangler.jsonc`, keyed by visitor IP. Those bindings only allow 10- or 60-second windows. Without them (for example in tests) the demo falls back to an in-memory limiter of 60 page views a minute and 3 joins an hour; that limiter lives in a single Worker isolate, so on Cloudflare it is only a rough per-IP limit.

A scheduled trigger runs every hour to cancel visitor memberships older than a day, remove their people and delete the customer records. It never touches the fixed cast. The visitor's cookie also expires after a day, and the footer's "Start over" link clears it sooner.

## Photo credits

- Kelp forest: [Lennart Rudolph](https://unsplash.com/photos/FhJv7md0NNw) on Unsplash
- Moon jellies: [Sergey Zolkin](https://unsplash.com/photos/G4fh99u0mmY) on Unsplash

The photos are used under the [Unsplash License](https://unsplash.com/license) and are not covered by the MIT licence.

## Project layout

```
src/
  index.tsx        # routes and the scheduled tidy job
  ophelio.ts       # every Ophelio call the site makes
  trace.ts         # records every request and response for the drawer
  views/           # server-rendered pages
  cast.ts          # loads the fixed cast from KV
  names.ts         # made-up family generator
  limits.ts        # rate limits and Turnstile check
scripts/
  setup.ts         # builds Tidewater data in your Ophelio project
  preview-mock.ts  # serves the site with mocked Ophelio data for local previews
public/
  tidewater.css    # brand styles
  tidewater-mark.svg
  kelp.jpg
  jellies.jpg
```

## Running the tests

```bash
npm run typecheck
npm run lint
npm test
```

The tests cover the calls in `src/ophelio.ts`, that every Ophelio call a route makes shows up in the trace, and the safety rules (cookie ownership, allowed cards at the gate, cast is read-only) against a mocked SDK/fetch. They do not need a real Ophelio API key.

`package.json` carries one npm override, `sharp` at `^0.35.5`: miniflare, which wrangler uses for local development, pins an older sharp with a high-severity librsvg advisory, and the override keeps `npm audit` clean.

## Reporting a security issue

The demo holds no real customer data or payments. If you find a security issue, please report it privately through this repository's **Security** tab rather than in a public issue.
