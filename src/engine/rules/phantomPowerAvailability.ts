import type { Device } from '../../data/devices.schema'
import type { CheckResult } from '../types'

/**
 * Condensers need 48V phantom power to operate at all. If the downstream
 * device can't supply it, the mic simply won't work; if it can, remind the
 * user to actually switch it on (a very common forgotten step).
 */
export function checkPhantomPowerAvailability(
  upstream: Device,
  downstream: Device,
): CheckResult | null {
  if (!upstream.specs.needsPhantomPower) return null

  if (!downstream.specs.providesPhantomPower) {
    return {
      severity: 'critical',
      title: 'No phantom power available',
      detail: `${upstream.name} requires 48V phantom power to operate, but ${downstream.name} doesn't supply it.`,
      fix: 'Use an interface, mixer, or preamp that provides phantom power for this input.',
    }
  }

  return {
    severity: 'pass',
    title: 'Phantom power available',
    detail: `${downstream.name} can supply the 48V phantom power ${upstream.name} needs.`,
    fix: 'Remember to switch on phantom power for this input.',
  }
}
