import { describe, expect, it } from 'vitest'
import { computePageSlices, pdfFileName, slugifyChainName } from './pdfLayout'

describe('slugifyChainName', () => {
  it('lowercases and hyphenates', () => {
    expect(slugifyChainName('My Vocal Chain')).toBe('my-vocal-chain')
  })

  it('strips punctuation, accents and edge separators', () => {
    expect(slugifyChainName('  Café #1 — SM7B!! ')).toBe('cafe-1-sm7b')
  })

  it('falls back to "untitled" when nothing usable remains', () => {
    expect(slugifyChainName('')).toBe('untitled')
    expect(slugifyChainName('!!! ???')).toBe('untitled')
    expect(slugifyChainName('録音')).toBe('untitled')
  })
})

describe('pdfFileName', () => {
  it('builds signal-chain-<name>.pdf', () => {
    expect(pdfFileName('Untitled chain')).toBe('signal-chain-untitled-chain.pdf')
  })
})

describe('computePageSlices', () => {
  it('returns a single slice when the content fits on one page', () => {
    expect(computePageSlices([100, 200], 500, 1000)).toEqual([{ start: 0, end: 500 }])
  })

  it('returns nothing for empty content or a zero page height', () => {
    expect(computePageSlices([], 0, 1000)).toEqual([])
    expect(computePageSlices([], 500, 0)).toEqual([])
  })

  it('breaks at the last break point that fits on the page', () => {
    // Page height 1000: the next block (starting at 1100) doesn't fit, so cut at 950.
    expect(computePageSlices([300, 650, 950, 1100], 1500, 1000)).toEqual([
      { start: 0, end: 950 },
      { start: 950, end: 1500 },
    ])
  })

  it('hard-cuts at the page boundary when no break point falls on the page', () => {
    expect(computePageSlices([], 2500, 1000)).toEqual([
      { start: 0, end: 1000 },
      { start: 1000, end: 2000 },
      { start: 2000, end: 2500 },
    ])
  })

  it('hard-cuts a block taller than a page instead of looping forever', () => {
    // The only break point is the top of a block 3000px tall.
    expect(computePageSlices([500], 3500, 1000)).toEqual([
      { start: 0, end: 500 },
      { start: 500, end: 1500 },
      { start: 1500, end: 2500 },
      { start: 2500, end: 3500 },
    ])
  })

  it('covers the whole height contiguously and accepts unsorted break points', () => {
    const slices = computePageSlices([1800, 400, 950, 2600, 1300], 3200, 1000)
    expect(slices[0].start).toBe(0)
    expect(slices[slices.length - 1].end).toBe(3200)
    slices.forEach((s, i) => {
      expect(s.end).toBeGreaterThan(s.start)
      expect(s.end - s.start).toBeLessThanOrEqual(1000)
      if (i > 0) expect(s.start).toBe(slices[i - 1].end)
    })
  })
})
