import type { Device } from '../data/devices.schema'
import type { CheckResult, ConnectionCheckResult } from './types'
import { evaluatePairs } from './evaluatePairs'
import { suggestGainBoostActions } from './fixes'
import { unconfirmedNote } from './unconfirmed'

// The device as it would be if its phantom-power supply were not in question.
function assumingPhantomConfirmed(device: Device): Device {
  if (unconfirmedNote(device, 'providesPhantomPower') === null) return device
  const { verification: _doubt, ...confirmed } = device
  return confirmed
}

function withActions(result: CheckResult, devices: Device[], connectionIndex: number): CheckResult {
  if (result.problem?.type !== 'gain_shortfall') return result

  const actions = suggestGainBoostActions(devices, connectionIndex)
  if (actions.length > 0) return { ...result, actions }

  // No booster button. If that is only because the next input's phantom power is unconfirmed (a
  // booster needs 48V from it), the static advice to "add an inline booster" would send the
  // reader to something the app has just declined to offer, so say what is really going on.
  // Any other reason a booster cannot work keeps the original advice.
  const downstream = devices[connectionIndex + 1]
  if (downstream && unconfirmedNote(downstream, 'providesPhantomPower') !== null) {
    const assumed = devices.map((d, i) => (i === connectionIndex + 1 ? assumingPhantomConfirmed(d) : d))
    if (suggestGainBoostActions(assumed, connectionIndex).length > 0) {
      return {
        ...result,
        fix: `A booster can't be safely recommended here until ${downstream.name}'s phantom power support is confirmed, because a booster needs 48V from this input. Check the manufacturer's manual, or route through a preamp with more headroom.`,
      }
    }
  }
  return result
}

export function evaluateChain(devices: Device[]): ConnectionCheckResult[] {
  return evaluatePairs(devices).map((connection) => ({
    ...connection,
    results: connection.results.map((r) => withActions(r, devices, connection.connectionIndex)),
  }))
}
