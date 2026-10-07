import { describe, it, expect } from 'vitest'
import { makeFamily, fitsPlan } from '../src/names.js'

describe('makeFamily', () => {
  it('makes one adult for a one-person plan', () => {
    for (let i = 0; i < 20; i += 1) {
      const people = makeFamily(1)
      expect(people).toEqual([{ name: expect.any(String), role: 'adult' }])
      expect(fitsPlan(people, 1)).toBe(true)
    }
  })

  it('makes a family that fits a bigger plan', () => {
    for (let i = 0; i < 20; i += 1) {
      const people = makeFamily(6)
      expect(people.length).toBeGreaterThanOrEqual(2)
      expect(people.length).toBeLessThanOrEqual(4)
      expect(fitsPlan(people, 6)).toBe(true)
    }
  })

  it('rejects names that are not made up', () => {
    expect(fitsPlan([{ name: 'Jane Realperson', role: 'adult' }], 1)).toBe(false)
    expect(fitsPlan([{ name: 'Alex Cove', role: 'child' }], 1)).toBe(false)
  })
})
