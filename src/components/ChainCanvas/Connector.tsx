import type { ConnectionCheckResult } from '../../engine/types'
import { worstSeverity } from '../../engine/types'

interface ConnectorProps {
  connection: ConnectionCheckResult
}

const SEVERITY_STYLES = {
  pass: { dot: 'bg-status-pass', line: 'bg-status-pass/40' },
  warning: { dot: 'bg-status-warning', line: 'bg-status-warning/40' },
  critical: { dot: 'bg-status-critical', line: 'bg-status-critical/40' },
} as const

export function Connector({ connection }: ConnectorProps) {
  const severity = worstSeverity(connection.results)
  const styles = SEVERITY_STYLES[severity]

  return (
    <div className="flex w-10 shrink-0 flex-col items-center justify-center gap-1">
      <div className={`h-0.5 w-full ${styles.line}`} />
      <span
        className={`h-2.5 w-2.5 rounded-full ${styles.dot}`}
        title={`Connection status: ${severity}`}
      />
    </div>
  )
}
