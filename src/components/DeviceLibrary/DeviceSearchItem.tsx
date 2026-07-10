import type { Device } from '../../data/devices.schema'

interface DeviceSearchItemProps {
  device: Device
  onAdd: (deviceId: string) => void
}

export function DeviceSearchItem({ device, onAdd }: DeviceSearchItemProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-soundorp-border-card bg-soundorp-card px-3 py-2">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-soundorp-text">
          {device.brand} {device.name}
        </span>
        <span className="text-xs capitalize text-soundorp-muted">
          {device.category.replace('_', ' ')}
          {device.subtype ? ` · ${device.subtype}` : ''}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onAdd(device.id)}
        className="shrink-0 rounded-md border border-soundorp-border-card px-2.5 py-1 text-xs font-medium text-soundorp-text hover:bg-[#1f1f1f]"
      >
        Add
      </button>
    </div>
  )
}
