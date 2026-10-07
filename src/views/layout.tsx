import type { TraceCall } from '../types.js'
import { snippets } from '../ophelio-snippets.js'
import type { JSX } from 'hono/jsx/jsx-runtime'

const REPO_FILE = 'https://github.com/TheGallery/ophelio-tidewater-demo/blob/main/src/ophelio.ts'

const QUIET_PAGE_HINTS: Record<string, { text: string; href: string; label: string }> = {
  '/gate': {
    text: 'Scan a card above to see the admission check, or',
    href: '/plans',
    label: 'see live plans (scene 1)',
  },
}

function QuietPage({ path }: { path: string }) {
  const hint = QUIET_PAGE_HINTS[path] ?? {
    text: 'To see one, open',
    href: '/plans',
    label: 'Plans (scene 1)',
  }
  return (
    <p class="bts-lead">
      This screen made no Ophelio calls. {hint.text} <a href={hint.href}>{hint.label}</a>.
    </p>
  )
}

function Drawer({ trace, path }: { trace: TraceCall[]; path: string }) {
  return (
    <details class="bts-drawer">
      <summary>
        <span class="bts-icon" aria-hidden="true">
          {'</>'}
        </span>
        Behind the scenes
      </summary>
      <div class="bts-panel">
        <p class="bts-lead">
          Every consumer action on Tidewater becomes an Ophelio API call. The API key stays on the
          server and is redacted here.
        </p>
        {trace.length === 0 ? <QuietPage path={path} /> : null}
        {trace.some((call) => call.cached) ? (
          <p class="bts-lead">
            Calls marked “Served from cache” were made a few minutes ago and kept for reuse, so this
            page did not call Ophelio for them again.
          </p>
        ) : null}
        <div class="bts-calls">
          {trace.map((call) => (
            <div class="bts-call">
              <div class="bts-call-head">
                <strong>{call.name}</strong>
                {call.request ? <code class="bts-request">{call.request}</code> : null}
                {call.cached ? <span class="badge badge-muted">Served from cache</span> : null}
              </div>
              <pre class="bts-code">
                <code>{snippets[call.name] ?? '// see src/ophelio.ts'}</code>
              </pre>
              <a class="bts-link" href={REPO_FILE} target="_blank" rel="noreferrer">
                View {call.name} in src/ophelio.ts
              </a>
              <details class="bts-response">
                <summary>Response</summary>
                <pre>
                  <code>{JSON.stringify(call.response, null, 2)}</code>
                </pre>
              </details>
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}

export function Layout({
  title,
  path,
  trace,
  turnstileSiteKey,
  children,
}: {
  title: string
  path: string
  trace: TraceCall[]
  turnstileSiteKey?: string
  children: JSX.Element
}) {
  const nav = [
    { href: '/', label: 'Home' },
    { href: '/plans', label: 'Plans' },
    { href: '/join', label: 'Join' },
    { href: '/cards', label: 'Cards' },
    { href: '/gate', label: 'Gate' },
    { href: '/till', label: 'Till' },
    { href: '/changes', label: 'Changes' },
  ]
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} — Tidewater Aquarium</title>
        <meta
          name="description"
          content="Tidewater Aquarium is a fictional aquarium. This demo shows Ophelio memberships, member cards, gate checks and guest passes."
        />
        <meta name="robots" content="noindex" />
        <link rel="icon" href="/tidewater-mark.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Hanken+Grotesk:wght@400;500;600;700&family=Spectral:wght@600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/tidewater.css" />
        {turnstileSiteKey ? (
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
        ) : null}
      </head>
      <body>
        <div class="site-shell">
          <header class="site-header">
            <div class="wrap header-row">
              <a class="brand" href="/">
                <img class="mark" src="/tidewater-mark.svg" alt="" />
                <span>Tidewater Aquarium</span>
              </a>
              <nav class="nav" aria-label="Main">
                {nav.map((item) => (
                  <a
                    href={item.href}
                    class={
                      item.href === path || (item.href !== '/' && path.startsWith(item.href))
                        ? 'active'
                        : ''
                    }
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
              <div class="header-right">
                <a class="button button-small" href="/join">
                  Become a member
                </a>
              </div>
            </div>
          </header>
          <main>{children}</main>
          <footer class="site-footer">
            <div class="wrap footer-inner">
              <div>
                <a class="brand footer-brand" href="/">
                  <img class="mark" src="/tidewater-mark.svg" alt="" />
                  <span>Tidewater Aquarium</span>
                </a>
                <p>The ocean, up close. Membership open all year in Kelpwick, California.</p>
              </div>
              <div class="footer-col">
                <h2>Explore</h2>
                <a href="/plans">Plans</a>
                <a href="/join">Join</a>
                <a href="/gate">Gate</a>
                <a href="/till">Till</a>
                <a href="/logout">Start over</a>
              </div>
              <div class="footer-col">
                <h2>For developers</h2>
                <a href="https://github.com/TheGallery/ophelio-tidewater-demo">
                  How this site is built
                </a>
                <a href="https://www.npmjs.com/package/@ophelio/sdk">Ophelio SDK</a>
              </div>
              <div class="footer-col">
                <h2>Credits</h2>
                <span>Kelp forest by Lennart Rudolph</span>
                <span>Jellies by Sergey Zolkin</span>
              </div>
            </div>
            <div class="wrap">
              <p class="footer-note">
                Tidewater Aquarium is fictional. This site is a demo built on{' '}
                <a href="https://app.ophel.io">Ophelio</a>.
              </p>
            </div>
          </footer>
        </div>
        <Drawer trace={trace} path={path} />
      </body>
    </html>
  )
}
