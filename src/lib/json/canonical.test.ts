import { describe, expect, it } from 'vitest'
import { canonicalStringify } from './canonical'

describe('canonicalStringify', () => {
  it('uses 2-space indent, LF and a trailing newline', () => {
    expect(canonicalStringify({ a: 1, b: [1, 2] })).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}\n')
  })

  it('keeps insertion key order', () => {
    expect(canonicalStringify({ z: 1, a: 2 })).toBe('{\n  "z": 1,\n  "a": 2\n}\n')
  })

  it('fixes time keys to 3 decimals, including inside arrays', () => {
    const out = canonicalStringify({ beats: [{ start: 1.5, d: 2 }], at: -0.0001 }, { timeKeys: new Set(['start', 'at']) })
    expect(out).toContain('"start": 1.500')
    expect(out).toContain('"d": 2')
    expect(out).toContain('"at": 0.000')
  })

  it('renders empty containers compactly and drops undefined', () => {
    expect(canonicalStringify({ a: [], b: {}, c: undefined })).toBe('{\n  "a": [],\n  "b": {}\n}\n')
  })

  it('is stable on a round trip', () => {
    const once = canonicalStringify({ a: { b: [1, { c: 'x' }] } })
    expect(canonicalStringify(JSON.parse(once))).toBe(once)
  })

  it('rejects non-finite numbers', () => {
    expect(() => canonicalStringify({ a: NaN })).toThrow()
  })
})
