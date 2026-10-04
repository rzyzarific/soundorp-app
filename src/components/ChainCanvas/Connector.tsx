import type { ConnectionCheckResult } from '../../engine/types'
import { worstSeverity } from '../../engine/types'

interface ConnectorProps {
  connection: ConnectionCheckResult
  // Where the devices stack in a column on small screens (the public page), run the connector
  // down between them instead of sideways. The builder's own row never stacks, so leaves this off.
  stackedOnMobile?: boolean
}

const SEVERITY_STYLES = {
  pass: { dot: 'bg-status-pass', line: 'bg-status-pass/40' },
  warning: { dot: 'bg-status-warning', line: 'bg-status-warning/40' },
  critical: { dot: 'bg-status-critical', line: 'bg-status-critical/40' },
} as const

export function Connector({ connection, stackedOnMobile = false }: ConnectorProps) {
  const severity = worstSeverity(connection.results)
  const styles = SEVERITY_STYLES[severity]

  return (
    <div
      className={
        stackedOnMobile
          ? 'flex h-10 shrink-0 flex-row items-center justify-center gap-1.5 sm:h-auto sm:w-10 sm:flex-col sm:gap-1'
          : 'flex w-10 shrink-0 flex-col items-center justify-center gap-1'
      }
    >
      <div className={`${stackedOnMobile ? 'h-full w-0.5 sm:h-0.5 sm:w-full' : 'h-0.5 w-full'} ${styles.line}`} />
      <span
        className={`h-2.5 w-2.5 rounded-full ${styles.dot}`}
        title={`Connection status: ${severity}`}
      />
    </div>
  )
}
