import type { Device } from '../../data/devices.schema'
import type { CheckResult, RuleContext } from '../types'

/**
 * The mic whose gain requirement a booster is passing along, plus the boosters
 * (contiguous, ending at the upstream device) sitting between it and this input.
 */
function findBoostedSource(
  upstream: Device,
  context: RuleContext,
): { source: Device; boosters: Device[]; totalBoost: number } | null {
  const { devices, upstreamIndex } = context
  if (devices[upstreamIndex] !== upstream) return null

  const boosters: Device[] = []
  let i = upstreamIndex
  while (i >= 0 && devices[i].specs.gainBoost !== undefined) {
    boosters.unshift(devices[i])
    i--
  }

  const source = devices[i]
  if (!source || source.specs.minPreampGain === undefined) return null

  const totalBoost = boosters.reduce((sum, b) => sum + (b.specs.gainBoost ?? 0), 0)
  return { source, boosters, totalBoost }
}

function boostedGainCheck(
  source: Device,
  boosters: Device[],
  totalBoost: number,
  downstream: Device,
  available: number,
): CheckResult {
  const original = source.specs.minPreampGain ?? 0
  const needed = Math.max(0, original - totalBoost)
  const boosterNames = boosters.map((b) => b.name).join(' + ')
  const summary = `${source.name} needs about ${original}dB of clean gain and ${boosterNames} adds ${totalBoost}dB, so ${downstream.name} has to supply about ${needed}dB`

  if (needed > available) {
    return {
      severity: 'warning',
      title: 'Insufficient gain headroom',
      detail: `${summary} — but it only provides up to ${available}dB, a ${needed - available}dB shortfall even with the booster.`,
      fix: 'Route through a preamp with more headroom.',
    }
  }

  return {
    severity: 'pass',
    title: 'Sufficient gain headroom',
    detail: `${summary}, and it provides up to ${available}dB — ${available - needed}dB of headroom to spare.`,
  }
}

/**
 * Low-output mics (SM7B, ribbons) need more clean gain than some interfaces
 * can provide, producing thin, noisy recordings. Flags the gap and suggests
 * an inline gain booster or a preamp with more headroom. When a booster is
 * already in the chain, its boost is credited against the mic's requirement.
 */
export function checkGainHeadroom(
  upstream: Device,
  downstream: Device,
  context?: RuleContext,
): CheckResult | null {
  const available = downstream.specs.maxPreampGain
  if (available === undefined) return null

  const needed = upstream.specs.minPreampGain
  if (needed !== undefined) {
    if (needed > available) {
      const gap = needed - available
      return {
        severity: 'warning',
        title: 'Insufficient gain headroom',
        detail: `${upstream.name} needs about ${needed}dB of clean gain, but ${downstream.name} only provides up to ${available}dB — a ${gap}dB shortfall.`,
        fix: 'Add an inline gain booster (e.g. Cloudlifter, FetHead, or a DM1 Dynamite) between the mic and this input, or route through a preamp with more headroom.',
        problem: { type: 'gain_shortfall', gap },
      }
    }

    const headroom = available - needed
    return {
      severity: 'pass',
      title: 'Sufficient gain headroom',
      detail: `${upstream.name} needs about ${needed}dB of clean gain, and ${downstream.name} provides up to ${available}dB — ${headroom}dB of headroom to spare.`,
    }
  }

  if (upstream.specs.gainBoost !== undefined && context) {
    const boosted = findBoostedSource(upstream, context)
    if (boosted) {
      return boostedGainCheck(
        boosted.source,
        boosted.boosters,
        boosted.totalBoost,
        downstream,
        available,
      )
    }
  }

  return null
}
