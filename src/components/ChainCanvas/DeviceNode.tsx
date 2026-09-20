import type { Device } from '../../data/devices.schema'
import { CATEGORY_LABELS } from '../../lib/categoryLabels'
import { ReportSpecButton } from '../ReportSpecButton'

interface DeviceNodeProps {
  device: Device
}

export function DeviceNode({ device }: DeviceNodeProps) {
  return (
    <div className="flex w-40 shrink-0 flex-col gap-1 rounded-lg border border-soundorp-border-card bg-soundorp-card p-3">
      <div className="flex items-start justify-between gap-1">
        <span className="font-orbitron text-xs font-black uppercase tracking-[0.6px] text-soundorp-muted">
          {CATEGORY_LABELS[device.category]}
          {device.subtype ? ` · ${device.subtype}` : ''}
        </span>
        <ReportSpecButton device={device} />
      </div>
      <span className="text-sm font-semibold text-soundorp-text">{device.brand}</span>
      <span className="text-sm text-soundorp-muted">{device.name}</span>
    </div>
  )
}
