import { ALL_DEVICES } from '../data/devices'
import type { Device } from '../data/devices.schema'
import { evaluatePairs } from './evaluatePairs'
import type { CheckSeverity, ConnectionCheckResult } from './types'

export interface SwapSuggestion {
  // Replaces every use of this device in the chain.
  fromId: string
  to: Device
  saving: number
}

const RANK: Record<CheckSeverity, number> = { pass: 0, warning: 1, critical: 2 }

// A check is identified by where it fired and what it was, so "the same warning" can be
// recognised on both sides of a swap.
function problemsOf(connections: ConnectionCheckResult[]): Map<string, number> {
  const problems = new Map<string, number>()
  for (const connection of connections) {
    for (const result of connection.results) {
      if (result.severity === 'pass') continue
      const key = `${connection.connectionIndex}|${result.title}`
      problems.set(key, Math.max(problems.get(key) ?? 0, RANK[result.severity]))
    }
  }
  return problems
}

// How many dB short each connection's gain is, keyed by connection. Includes the shortfall
// left over after a booster, which is the same kind of problem.
function shortfallsOf(connections: ConnectionCheckResult[]): Map<number, number> {
  const shortfalls = new Map<number, number>()
  for (const connection of connections) {
    for (const result of connection.results) {
      const problem = result.problem
      if (problem?.type !== 'gain_shortfall' && problem?.type !== 'boosted_gain_shortfall') continue
      shortfalls.set(connection.connectionIndex, (shortfalls.get(connection.connectionIndex) ?? 0) + problem.gap)
    }
  }
  return shortfalls
}

/**
 * True when swapping made nothing worse:
 *  - every warning or critical in the new chain was already there, at the same severity or
 *    milder (problems may go away; none may appear or escalate); and
 *  - no gain shortfall got bigger, even though "short on gain" is the same warning at the
 *    same severity whether it is 4 dB or 14 dB. A shortfall may stay the same or shrink.
 */
export function isNoWorse(before: ConnectionCheckResult[], after: ConnectionCheckResult[]): boolean {
  const was = problemsOf(before)
  for (const [key, rank] of problemsOf(after)) {
    const previous = was.get(key)
    if (previous === undefined || rank > previous) return false
  }

  const wasShort = shortfallsOf(before)
  for (const [connectionIndex, gap] of shortfallsOf(after)) {
    if (gap > (wasShort.get(connectionIndex) ?? 0)) return false
  }
  return true
}

/**
 * Whether `candidate` is the same kind of thing as `current`, so the swap is a cheaper
 * version of the same role rather than a different kind of device:
 *  - same category;
 *  - a gain booster is only replaced by a gain booster, so a fix the chain already has is
 *    never swapped for something that merely isn't a booster;
 *  - mics keep their type (dynamic stays dynamic, ribbon stays ribbon).
 */
function isSameKind(current: Device, candidate: Device): boolean {
  if (candidate.category !== current.category) return false
  if ((candidate.specs.gainBoost !== undefined) !== (current.specs.gainBoost !== undefined)) return false
  if (current.category === 'microphone' && candidate.subtype !== current.subtype) return false
  return true
}

/**
 * Cheaper catalog alternatives for one device in a chain, closest in price first (the
 * smallest step down keeps the most of what you were buying).
 *
 * A candidate must have a price below the current one, be the same kind of device, and
 * leave the whole chain's checks no worse (see isNoWorse). Devices without a price have
 * no alternatives, because "cheaper" can't be established.
 */
export function findCheaperAlternatives(
  devices: Device[],
  deviceId: string,
  catalog: Device[] = ALL_DEVICES,
  limit = 3,
): SwapSuggestion[] {
  const current = devices.find((d) => d.id === deviceId)
  if (!current || current.msrp === undefined) return []
  const currentPrice = current.msrp

  const before = evaluatePairs(devices)

  return catalog
    .filter(
      (candidate) =>
        candidate.id !== current.id &&
        candidate.msrp !== undefined &&
        candidate.msrp < currentPrice &&
        isSameKind(current, candidate),
    )
    .filter((candidate) => {
      const swapped = devices.map((d) => (d.id === deviceId ? candidate : d))
      return isNoWorse(before, evaluatePairs(swapped))
    })
    .sort((a, b) => (b.msrp ?? 0) - (a.msrp ?? 0) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((to) => ({ fromId: deviceId, to, saving: currentPrice - (to.msrp ?? 0) }))
}
