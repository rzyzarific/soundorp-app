import type { Device } from '../../data/devices.schema'
import type { CheckResult } from '../types'
import { VERIFY_BEFORE_RELYING, unconfirmedNote } from '../unconfirmed'

/**
 * Condensers need 48V phantom power to operate at all. If the downstream
 * device can't supply it, the mic simply won't work; if it can, remind the
 * user to actually switch it on (a very common forgotten step).
 *
 * When the catalog marks either side's phantom spec `in_question` (whether the mic needs it,
 * or whether the input supplies it), the answer is not trustworthy either way, so it is
 * replaced by an explicit "unconfirmed" warning rather than a clean pass or critical.
 */
export function checkPhantomPowerAvailability(
  upstream: Device,
  downstream: Device,
): CheckResult | null {
  const needDoubt = unconfirmedNote(upstream, 'needsPhantomPower')
  const supplyDoubt = unconfirmedNote(downstream, 'providesPhantomPower')

  if (needDoubt !== null || supplyDoubt !== null) {
    // Nothing to say if the mic is known not to need phantom power.
    if (needDoubt === null && !upstream.specs.needsPhantomPower) return null
    const reasons = [
      needDoubt !== null && `Whether ${upstream.name} needs phantom power is unconfirmed: ${needDoubt}`,
      supplyDoubt !== null &&
        `Whether ${downstream.name} supplies phantom power on this input is unconfirmed: ${supplyDoubt}`,
    ].filter(Boolean)
    return {
      severity: 'warning',
      title: 'Phantom power unconfirmed',
      detail: reasons.join(' '),
      fix: VERIFY_BEFORE_RELYING,
      unconfirmed: true,
    }
  }

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
