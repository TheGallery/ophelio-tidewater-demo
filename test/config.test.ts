import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('wrangler.jsonc', () => {
  // With both an id and a preview_id, `wrangler kv key put` makes you pick one with --preview.
  it('gives VISITORS a single KV namespace id', () => {
    const config = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
    expect(config).not.toContain('preview_id')
  })
})
