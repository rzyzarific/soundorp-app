import type { Device } from '../../data/devices.schema'
import type { CheckResult } from '../types'

/**
 * Ribbon mics (and other phantomPowerDamages devices) can be destroyed if the
 * downstream device has 48V phantom power enabled. This is the single
 * highest-stakes check in the engine, so it runs before the availability check.
 */
export function checkPhantomPowerDamage(upstream: Device, downstream: Device): CheckResult | null {
  if (!upstream.specs.phantomPowerDamages) return null
  if (!downstream.specs.providesPhantomPower) return null

  return {
    severity: 'critical',
    title: 'Phantom power can damage this microphone',
    detail: `${upstream.name} can be damaged if 48V phantom power is applied. ${downstream.name} supplies phantom power on this input.`,
    fix: 'Make sure phantom power is switched off for this input before connecting the mic.',
  }
}
