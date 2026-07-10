import type { Device } from '../data/devices.schema'

export type CheckSeverity = 'pass' | 'warning' | 'critical'

export interface CheckResult {
  severity: CheckSeverity
  title: string
  detail: string
  fix?: string
}

export type CompatibilityRule = (upstream: Device, downstream: Device) => CheckResult | null

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
