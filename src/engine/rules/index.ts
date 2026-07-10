import type { CompatibilityRule } from '../types'
import { checkPhantomPowerDamage } from './phantomPowerDamage'
import { checkPhantomPowerAvailability } from './phantomPowerAvailability'
import { checkGainHeadroom } from './gainHeadroom'
import { checkConnectorMatch } from './connectorMatch'
import { checkImpedance } from './impedance'

export const rules: CompatibilityRule[] = [
  checkPhantomPowerDamage,
  checkPhantomPowerAvailability,
  checkGainHeadroom,
  checkConnectorMatch,
  checkImpedance,
]

export {
  checkPhantomPowerDamage,
  checkPhantomPowerAvailability,
  checkGainHeadroom,
  checkConnectorMatch,
  checkImpedance,
}
