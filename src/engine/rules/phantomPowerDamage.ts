import type { Device } from '../../data/devices.schema'
import type { CheckResult } from '../types'
import { VERIFY_BEFORE_RELYING, unconfirmedNote } from '../unconfirmed'

/**
 * Ribbon mics (and other phantomPowerDamages devices) can be destroyed if the
 * downstream device has 48V phantom power enabled. This is the single
 * highest-stakes check in the engine, so it runs before the availability check.
 *
 * When the catalog marks either side's phantom spec `in_question`, a critical (or silence) would
 * claim more certainty than the data has. The pair is still flagged, as an explicit
 * "unconfirmed" warning, whenever damage is possible on either reading of the doubtful spec.
 */
export function checkPhantomPowerDamage(upstream: Device, downstream: Device): CheckResult | null {
  const damageDoubt = unconfirmedNote(upstream, 'phantomPowerDamages')
  const supplyDoubt = unconfirmedNote(downstream, 'providesPhantomPower')

  if (damageDoubt !== null || supplyDoubt !== null) {
    const canBeDamaged = upstream.specs.phantomPowerDamages === true || damageDoubt !== null
    const mayBeSupplied = downstream.specs.providesPhantomPower === true || supplyDoubt !== null
    if (!canBeDamaged || !mayBeSupplied) return null
    const reasons = [
      damageDoubt !== null &&
        `Whether ${upstream.name} can be damaged by phantom power is unconfirmed: ${damageDoubt}`,
      supplyDoubt !== null &&
        `Whether ${downstream.name} supplies phantom power on this input is unconfirmed: ${supplyDoubt}`,
    ].filter(Boolean)
    return {
      severity: 'warning',
      title: 'Phantom power risk unconfirmed',
      detail: `${reasons.join(' ')} If it does supply phantom power, ${upstream.name} could be damaged.`,
      fix: `Keep phantom power switched off for this input. ${VERIFY_BEFORE_RELYING}`,
      unconfirmed: true,
    }
  }

  if (!upstream.specs.phantomPowerDamages) return null
  if (!downstream.specs.providesPhantomPower) return null

  return {
    severity: 'critical',
    title: 'Phantom power can damage this microphone',
    detail: `${upstream.name} can be damaged if 48V phantom power is applied. ${downstream.name} supplies phantom power on this input.`,
    fix: 'Make sure phantom power is switched off for this input before connecting the mic.',
  }
}
