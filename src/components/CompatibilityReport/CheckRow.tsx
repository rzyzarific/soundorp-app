import type { CheckResult } from '../../engine/types'

interface CheckRowProps {
  result: CheckResult
}

const SEVERITY_ICON: Record<CheckResult['severity'], string> = {
  pass: '✓',
  warning: '⚠',
  critical: '✕',
}

const SEVERITY_STYLES: Record<CheckResult['severity'], { chip: string; accent: string }> = {
  pass: {
    chip: 'border-status-pass-border bg-status-pass-bg',
    accent: 'text-status-pass-text',
  },
  warning: {
    chip: 'border-status-warning-border bg-status-warning-bg',
    accent: 'text-status-warning-text',
  },
  critical: {
    chip: 'border-status-critical-border bg-status-critical-bg',
    accent: 'text-status-critical-text',
  },
}

export function CheckRow({ result }: CheckRowProps) {
  const styles = SEVERITY_STYLES[result.severity]

  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 ${styles.chip}`}>
      <span className={`mt-0.5 text-sm font-bold ${styles.accent}`} aria-hidden="true">
        {SEVERITY_ICON[result.severity]}
      </span>
      <div className="flex flex-col gap-0.5 text-sm">
        <span className={`font-semibold ${styles.accent}`}>{result.title}</span>
        <span className="text-soundorp-text">{result.detail}</span>
        {result.fix && <span className="italic text-soundorp-muted">Fix: {result.fix}</span>}
      </div>
    </div>
  )
}
