import type { Device } from '../../data/devices.schema'
import { CATEGORY_LABELS } from '../../lib/categoryLabels'
import { ReportSpecButton } from '../ReportSpecButton'

interface DeviceNodeProps {
  device: Device
  // A public, shared page: nothing to click.
  readOnly?: boolean
}

export function DeviceNode({ device, readOnly = false }: DeviceNodeProps) {
  return (
    <div className="flex w-40 shrink-0 flex-col gap-1 rounded-lg border border-soundorp-border-card bg-soundorp-card p-3">
      <div className="flex items-start justify-between gap-1">
        <span className="font-orbitron text-xs font-black uppercase tracking-[0.6px] text-soundorp-muted">
          {CATEGORY_LABELS[device.category]}
          {device.subtype ? ` · ${device.subtype}` : ''}
          {device.isCustom ? ' · Custom' : ''}
        </span>
        {!device.isCustom && !readOnly && <ReportSpecButton device={device} />}
      </div>
      <span className="break-words text-sm font-semibold text-soundorp-text">{device.brand}</span>
      <span className="break-words text-sm text-soundorp-muted">{device.name}</span>
    </div>
  )
}
