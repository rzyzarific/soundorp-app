import type { CheckResult } from '../../engine/types'
import { useChainStore } from '../../store/useChainStore'

interface CheckRowProps {
  result: CheckResult
  // A public, shared page: no buttons that change a chain, so the written advice shows instead.
  readOnly?: boolean
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

export function CheckRow({ result, readOnly = false }: CheckRowProps) {
  const styles = SEVERITY_STYLES[result.severity]
  const insertDevice = useChainStore((s) => s.insertDevice)
  const hasActions = !readOnly && result.actions !== undefined && result.actions.length > 0

  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 ${styles.chip}`}>
      <span className={`mt-0.5 text-sm font-bold ${styles.accent}`} aria-hidden="true">
        {SEVERITY_ICON[result.severity]}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5 break-words text-sm">
        <span className={`font-semibold ${styles.accent}`}>{result.title}</span>
        <span className="text-soundorp-text">{result.detail}</span>
        {/* The buttons replace the written advice; keep the text when there's nothing to click. */}
        {result.fix && !hasActions && (
          <span className="italic text-soundorp-muted">Fix: {result.fix}</span>
        )}
        {hasActions && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {result.actions!.map((action, i) => (
              <button
                key={action.deviceId}
                type="button"
                onClick={() => insertDevice(action.position, action.deviceId)}
                className={
                  i === 0
                    ? 'rounded-md bg-soundorp-red px-2 py-1 text-xs font-medium text-white hover:bg-soundorp-red/90'
                    : 'rounded-md border border-soundorp-border px-2 py-1 text-xs font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text'
                }
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
