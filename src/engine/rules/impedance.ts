import type { Device } from '../../data/devices.schema'
import type { CheckResult } from '../types'

/**
 * Stubbed for Milestone 1 (see plan §8.6): the ~5x output/input impedance
 * rule of thumb needs category-specific thresholds that haven't been
 * researched yet. Registered now so the rules list doesn't need to change
 * shape when Milestone 1.5 implements it for real.
 */
export function checkImpedance(_upstream: Device, _downstream: Device): CheckResult | null {
  return null
}
