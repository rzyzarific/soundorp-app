import { useState } from 'react'
import type { Device } from '../../data/devices.schema'
import { isConventionalSignalFlow } from '../../lib/signalFlowOrder'

interface SignalFlowHintProps {
  devices: Device[]
}

export function SignalFlowHint({ devices }: SignalFlowHintProps) {
  // Keyed by the current order so dismissing only lasts until the order
  // actually changes again, not for the rest of the session.
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const orderKey = devices.map((d) => d.id).join(',')

  if (devices.length < 2) return null
  if (isConventionalSignalFlow(devices)) return null
  if (dismissedKey === orderKey) return null

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2 text-sm text-status-warning-text">
      <p>
        Typical signal flow is Mic → Preamp → Interface → DAW → Monitors. Your current order may
        work, but double-check it makes sense.
      </p>
      <button
        type="button"
        onClick={() => setDismissedKey(orderKey)}
        aria-label="Dismiss signal flow hint"
        className="shrink-0 text-status-warning-text/70 hover:text-status-warning-text"
      >
        ×
      </button>
    </div>
  )
}
