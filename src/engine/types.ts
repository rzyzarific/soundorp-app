import type { Device } from '../data/devices.schema'

export type CheckSeverity = 'pass' | 'warning' | 'critical'

// A one-click remedy the UI can apply to the chain.
export interface FixAction {
  type: 'insert_device'
  deviceId: string
  // Index in the chain at which the device is inserted.
  position: number
  label: string
}

// Machine-readable description of what went wrong, so fixes can be derived without
// parsing text. Rules only describe the problem; evaluateChain attaches the actions.
export type CheckProblem =
  // A mic needs more gain than the next input has; a booster could close it.
  | { type: 'gain_shortfall'; gap: number }
  // The same shortfall left over after boosters already in the chain. It carries its size
  // so it can be compared, but it is a different type so no further booster is offered.
  | { type: 'boosted_gain_shortfall'; gap: number }

export interface CheckResult {
  severity: CheckSeverity
  title: string
  detail: string
  fix?: string
  problem?: CheckProblem
  actions?: FixAction[]
  // The catalog marks a spec this result rests on `in_question`: the result says so instead of
  // answering as if the data were trusted.
  unconfirmed?: boolean
}

// Where a rule is being evaluated within the full chain. Optional because most rules
// only need the adjacent pair.
export interface RuleContext {
  devices: Device[]
  upstreamIndex: number
}

export type CompatibilityRule = (
  upstream: Device,
  downstream: Device,
  context?: RuleContext,
) => CheckResult | null

export interface ConnectionCheckResult {
  connectionIndex: number
  upstreamId: string
  downstreamId: string
  results: CheckResult[]
}

const SEVERITY_RANK: Record<CheckSeverity, number> = {
  pass: 0,
  warning: 1,
  critical: 2,
}

export function worstSeverity(results: CheckResult[]): CheckSeverity {
  return results.reduce<CheckSeverity>(
    (worst, r) => (SEVERITY_RANK[r.severity] > SEVERITY_RANK[worst] ? r.severity : worst),
    'pass',
  )
}
