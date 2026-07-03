# Ophelio Tidewater Demo

Standalone SvelteKit demo scaffold for the Tidewater experience. Session 1 only sets up the deployable application shell, Cloudflare target, baseline tooling, and verification scripts.

This repository intentionally does not include Tidewater UI, domain behavior, or Ophelio SDK integration yet.

## Stack

- SvelteKit with TypeScript
- Svelte 5 runes mode
- Cloudflare adapter
- Vite and Vitest
- ESLint and Prettier

## Getting Started

Install dependencies:

```sh
npm install
```

Copy the example environment file:

```sh
cp .env.example .env
```

Run the development server:

```sh
npm run dev
```

## Scripts

- `npm run dev` starts Vite locally.
- `npm run check` runs SvelteKit sync and type checks.
- `npm run lint` runs ESLint.
- `npm run test` runs Vitest.
- `npm run build` creates the Cloudflare-targeted production build.
- `npm run verify` runs check, lint, tests, and build.

## Cloudflare

The project uses `@sveltejs/adapter-cloudflare` and includes a minimal `wrangler.jsonc` for a Cloudflare Pages deployment target. Runtime bindings are intentionally empty for Session 1.

Adapter output is written to `.svelte-kit/cloudflare/`:

```sh
npm run build
```

Deployment setup, Cloudflare account configuration, and Ophelio SDK runtime variables should be added in a later session.

## Session Scope

Completed in Session 1:

- Cloudflare adapter configured
- Baseline scripts and tooling configured
- `.env.example` added
- Repository README added
- Git repository initialized
- Check, build, and tests verified

Deferred:

- Tidewater UI port
- Ophelio SDK integration
- Cloudflare runtime bindings
