import type { Device } from '../../data/devices.schema'
import type { CheckResult } from '../types'

/**
 * Flags when nothing in the upstream device's outputs overlaps with the
 * downstream device's inputs. If either side omits its connector list
 * (irrelevant for that device), there's nothing to check.
 */
export function checkConnectorMatch(upstream: Device, downstream: Device): CheckResult | null {
  const outputs = upstream.specs.outputConnectors
  const inputs = downstream.specs.inputConnectors
  if (!outputs || outputs.length === 0 || !inputs || inputs.length === 0) return null

  const match = outputs.find((c) => inputs.includes(c))
  if (match === undefined) {
    return {
      severity: 'warning',
      title: 'No matching connector',
      detail: `${upstream.name} outputs ${outputs.join('/')}, but ${downstream.name} only accepts ${inputs.join('/')} on this input.`,
      fix: `You'll need a cable or adapter that converts ${outputs.join('/')} to ${inputs.join('/')}.`,
    }
  }

  return {
    severity: 'pass',
    title: 'Connectors match',
    detail: `${upstream.name} connects to ${downstream.name} via ${match}.`,
  }
}
