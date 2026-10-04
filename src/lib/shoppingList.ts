import type { Device } from '../data/devices.schema'

export const MAX_BUDGET = 1_000_000

/**
 * When the catalog's msrp values were last entered or checked (ISO date). Prices are a
 * snapshot, not live, so everything that shows them says so using this date. Update it
 * whenever the catalog's prices are refreshed. Entered with the 300-device catalog on
 * 2026-09-18; the three in-line boosters were checked against retailers on 2026-10-03, so
 * the older date is used for the whole catalog.
 */
export const PRICES_AS_OF = '2026-09-18'

/** "September 2026". Month and year only: the prices aren't known more precisely than that. */
export function formatPriceDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Shown wherever prices are, so nobody mistakes a list price for what a shop charges today. */
export const PRICE_DISCLAIMER = `Prices are approximate list prices as of ${formatPriceDate(PRICES_AS_OF)} — check current pricing before buying.`

export interface ShoppingLine {
  device: Device
  quantity: number
  // Undefined when the device has no price; such lines are listed but not totalled.
  unitPrice?: number
  subtotal?: number
}

export interface ShoppingList {
  lines: ShoppingLine[]
  total: number
  // Devices with no price, counted per occurrence, so the total can say what it leaves out.
  unpricedCount: number
}

/**
 * One line per distinct device, in order of first appearance, with a quantity for repeats.
 * Prices come from msrp; custom devices use whatever price their owner entered, if any.
 */
export function buildShoppingList(devices: Device[]): ShoppingList {
  const byId = new Map<string, ShoppingLine>()

  for (const device of devices) {
    const existing = byId.get(device.id)
    if (existing) {
      existing.quantity += 1
    } else {
      byId.set(device.id, { device, quantity: 1, unitPrice: device.msrp })
    }
  }

  let total = 0
  let unpricedCount = 0
  const lines = [...byId.values()].map((line) => {
    if (line.unitPrice === undefined) {
      unpricedCount += line.quantity
      return line
    }
    const subtotal = line.unitPrice * line.quantity
    total += subtotal
    return { ...line, subtotal }
  })

  return { lines, total, unpricedCount }
}

export type BudgetStatus =
  | { state: 'under'; amount: number }
  | { state: 'over'; amount: number }
  | { state: 'exact'; amount: 0 }

/** How the total compares with the budget. Null when no budget is set. */
export function budgetStatus(total: number, budget: number | null): BudgetStatus | null {
  if (budget === null) return null
  // Compare in cents so 0.1 + 0.2-style float drift can't turn "exact" into "over by $0".
  const diff = Math.round((budget - total) * 100) / 100
  if (diff > 0) return { state: 'under', amount: diff }
  if (diff < 0) return { state: 'over', amount: -diff }
  return { state: 'exact', amount: 0 }
}

/** "$1,234" for whole dollars, "$1,234.50" when there are cents. */
export function formatPrice(amount: number): string {
  const whole = Number.isInteger(amount)
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })
}

/** Parses the budget field: blank clears it; anything else must be a sensible dollar amount. */
export function parseBudget(text: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const cleaned = text.trim().replace(/^\$/, '').replace(/,/g, '').trim()
  if (cleaned === '') return { ok: true, value: null }
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value < 0 || value > MAX_BUDGET) {
    return { ok: false, error: `Enter a budget between $0 and ${formatPrice(MAX_BUDGET)}.` }
  }
  return { ok: true, value }
}
