import type { Device } from '../../data/devices.schema'
import type { CheckResult } from '../types'

/**
 * Low-output mics (SM7B, ribbons) need more clean gain than some interfaces
 * can provide, producing thin, noisy recordings. Flags the gap and suggests
 * an inline gain booster or a preamp with more headroom.
 */
export function checkGainHeadroom(upstream: Device, downstream: Device): CheckResult | null {
  const needed = upstream.specs.minPreampGain
  const available = downstream.specs.maxPreampGain
  if (needed === undefined || available === undefined) return null

  if (needed > available) {
    const gap = needed - available
    return {
      severity: 'warning',
      title: 'Insufficient gain headroom',
      detail: `${upstream.name} needs about ${needed}dB of clean gain, but ${downstream.name} only provides up to ${available}dB — a ${gap}dB shortfall.`,
      fix: 'Add an inline gain booster (e.g. Cloudlifter, FetHead, or a DM1 Dynamite) between the mic and this input, or route through a preamp with more headroom.',
    }
  }

  const headroom = available - needed
  return {
    severity: 'pass',
    title: 'Sufficient gain headroom',
    detail: `${upstream.name} needs about ${needed}dB of clean gain, and ${downstream.name} provides up to ${available}dB — ${headroom}dB of headroom to spare.`,
  }
}
