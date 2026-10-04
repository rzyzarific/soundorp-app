import { describe, expect, it } from 'vitest'
import {
  PRICES_AS_OF,
  PRICE_DISCLAIMER,
  budgetStatus,
  buildShoppingList,
  formatPrice,
  formatPriceDate,
  parseBudget,
} from './shoppingList'
import { device } from '../engine/rules/testFixtures'

const priced = (id: string, msrp: number | undefined) => device({ id, name: id, msrp })

describe('buildShoppingList', () => {
  it('totals the prices of a chain', () => {
    const list = buildShoppingList([priced('mic', 399), priced('iface', 199), priced('mon', 129)])

    expect(list.total).toBe(727)
    expect(list.lines.map((l) => [l.device.id, l.unitPrice, l.subtotal, l.quantity])).toEqual([
      ['mic', 399, 399, 1],
      ['iface', 199, 199, 1],
      ['mon', 129, 129, 1],
    ])
    expect(list.unpricedCount).toBe(0)
  })

  it('folds repeats into one line with a quantity and multiplies the price', () => {
    const list = buildShoppingList([priced('mic', 100), priced('iface', 200), priced('mic', 100)])

    expect(list.lines).toHaveLength(2)
    expect(list.lines[0]).toMatchObject({ quantity: 2, unitPrice: 100, subtotal: 200 })
    expect(list.total).toBe(400)
  })

  it('keeps lines in order of first appearance', () => {
    const list = buildShoppingList([priced('b', 1), priced('a', 1), priced('b', 1)])

    expect(list.lines.map((l) => l.device.id)).toEqual(['b', 'a'])
  })

  it('lists devices with no price but leaves them out of the total, and counts them', () => {
    const list = buildShoppingList([priced('mic', 100), priced('mystery', undefined), priced('mystery', undefined)])

    expect(list.total).toBe(100)
    expect(list.unpricedCount).toBe(2)
    const mystery = list.lines.find((l) => l.device.id === 'mystery')!
    expect(mystery).toMatchObject({ quantity: 2 })
    expect(mystery.unitPrice).toBeUndefined()
    expect(mystery.subtotal).toBeUndefined()
  })

  it('treats a price of zero as a real price, not as missing', () => {
    const list = buildShoppingList([priced('free-daw', 0), priced('mic', 50)])

    expect(list.unpricedCount).toBe(0)
    expect(list.total).toBe(50)
    expect(list.lines[0].subtotal).toBe(0)
  })

  it('uses a custom device’s own price', () => {
    const custom = device({ id: 'custom-1', name: 'Mine', msrp: 229, isCustom: true })

    expect(buildShoppingList([custom]).total).toBe(229)
  })

  it('handles an empty chain', () => {
    expect(buildShoppingList([])).toEqual({ lines: [], total: 0, unpricedCount: 0 })
  })

  it('does not mutate the devices it is given', () => {
    const chain = [priced('a', 10), priced('a', 10)]
    const snapshot = JSON.stringify(chain)

    buildShoppingList(chain)

    expect(JSON.stringify(chain)).toBe(snapshot)
  })

  it('is exact with cents', () => {
    expect(buildShoppingList([priced('a', 0.1), priced('b', 0.2)]).total).toBeCloseTo(0.3, 10)
  })
})

describe('budgetStatus', () => {
  it('is null with no budget', () => {
    expect(budgetStatus(500, null)).toBeNull()
  })

  it('reports how far under budget', () => {
    expect(budgetStatus(700, 1000)).toEqual({ state: 'under', amount: 300 })
  })

  it('reports how far over budget', () => {
    expect(budgetStatus(1250, 1000)).toEqual({ state: 'over', amount: 250 })
  })

  it('reports exactly on budget', () => {
    expect(budgetStatus(1000, 1000)).toEqual({ state: 'exact', amount: 0 })
  })

  it('is not fooled by floating point drift', () => {
    expect(budgetStatus(0.1 + 0.2, 0.3)).toEqual({ state: 'exact', amount: 0 })
  })

  it('treats a zero budget as a real budget', () => {
    expect(budgetStatus(10, 0)).toEqual({ state: 'over', amount: 10 })
    expect(budgetStatus(0, 0)).toEqual({ state: 'exact', amount: 0 })
  })
})

describe('formatPrice', () => {
  it.each([
    [0, '$0'],
    [99, '$99'],
    [1234, '$1,234'],
    [1234.5, '$1,234.50'],
    [1000000, '$1,000,000'],
  ])('formats %s as %s', (amount, expected) => {
    expect(formatPrice(amount)).toBe(expected)
  })
})

describe('price date and disclaimer', () => {
  it('formats the date as month and year, whatever the viewer’s time zone', () => {
    expect(formatPriceDate('2026-09-18')).toBe('September 2026')
    expect(formatPriceDate('2026-01-01')).toBe('January 2026')
    expect(formatPriceDate('2026-12-31')).toBe('December 2026')
  })

  it('has a real ISO date that is not in the future', () => {
    expect(PRICES_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const date = new Date(`${PRICES_AS_OF}T00:00:00Z`)
    expect(Number.isNaN(date.getTime())).toBe(false)
    expect(date.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('is not older than the catalog it describes', () => {
    // The catalog was expanded (and priced) on 2026-09-18; an earlier date would be wrong.
    expect(PRICES_AS_OF >= '2026-09-18').toBe(true)
  })

  it('tells people the prices are approximate, dated, and to check before buying', () => {
    expect(PRICE_DISCLAIMER).toContain('approximate')
    expect(PRICE_DISCLAIMER).toContain(formatPriceDate(PRICES_AS_OF))
    expect(PRICE_DISCLAIMER).toMatch(/check current pricing before buying/i)
  })
})

describe('parseBudget', () => {
  it.each([
    ['1000', 1000],
    ['  1,500  ', 1500],
    ['$2,000', 2000],
    ['$ 750', 750],
    ['99.50', 99.5],
    ['0', 0],
  ])('parses %j as %s', (text, value) => {
    expect(parseBudget(text)).toEqual({ ok: true, value })
  })

  it.each(['', '   ', '$'])('treats blank-ish %j as "no budget"', (text) => {
    expect(parseBudget(text)).toEqual({ ok: true, value: null })
  })

  it.each(['abc', '-5', '1e9', '1000001', 'NaN', 'Infinity', '12 34'])('rejects %j', (text) => {
    const result = parseBudget(text)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/budget between/i)
  })
})
