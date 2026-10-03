import type { Device } from '../data/devices.schema'
import type { CheckResult, ConnectionCheckResult } from './types'
import { evaluatePairs } from './evaluatePairs'
import { suggestGainBoostActions } from './fixes'

function withActions(result: CheckResult, devices: Device[], connectionIndex: number): CheckResult {
  if (result.problem?.type !== 'gain_shortfall') return result

  const actions = suggestGainBoostActions(devices, connectionIndex)
  return actions.length > 0 ? { ...result, actions } : result
}

export function evaluateChain(devices: Device[]): ConnectionCheckResult[] {
  return evaluatePairs(devices).map((connection) => ({
    ...connection,
    results: connection.results.map((r) => withActions(r, devices, connection.connectionIndex)),
  }))
}
