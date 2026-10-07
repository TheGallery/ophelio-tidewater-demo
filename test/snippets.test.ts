import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { snippets } from '../src/ophelio-snippets.js'
import { sceneNames } from '../src/trace.js'

const source = readFileSync(new URL('../src/ophelio.ts', import.meta.url), 'utf8')
const flatSource = source.replace(/\s+/g, ' ')

describe('drawer snippets', () => {
  it('has a snippet for every traced scene', () => {
    for (const name of sceneNames) {
      expect(snippets, name).toHaveProperty(name)
    }
  })

  it.each(Object.entries(snippets))('%s matches src/ophelio.ts', (_name, snippet) => {
    for (const line of snippet.split('\n')) {
      const trimmed = line.trim().replace(/\s+/g, ' ')
      if (!trimmed || trimmed.startsWith('//')) continue
      expect(flatSource).toContain(trimmed)
    }
  })

  it.each(Object.entries(snippets))('%s shows every Ophelio call it makes', (name, snippet) => {
    const start = source.search(new RegExp(`function ${name}\\(`))
    expect(start, name).toBeGreaterThan(-1)
    const body = source.slice(start, source.indexOf('\n}\n', start))
    for (const [call] of body.matchAll(/ophelio\.\w+\.\w+/g)) {
      expect(snippet).toContain(call)
    }
  })
})
