import { useState } from 'react'
import type { Device } from '../../data/devices.schema'
import { ReportSpecButton } from '../ReportSpecButton'

interface DeviceSearchItemProps {
  device: Device
  onAdd: (deviceId: string) => void
  // Only passed for the user's own devices.
  onEdit?: (device: Device) => void
  onDelete?: (deviceId: string) => void
}

const smallButton =
  'rounded px-1 py-0.5 text-xs text-soundorp-muted underline-offset-2 hover:text-soundorp-text hover:underline'

export function DeviceSearchItem({ device, onAdd, onEdit, onDelete }: DeviceSearchItemProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-soundorp-border-card bg-soundorp-card px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-soundorp-text">
          {device.brand} {device.name}
        </span>
        <span className="text-xs capitalize text-soundorp-muted">
          {device.category.replace('_', ' ')}
          {device.subtype ? ` · ${device.subtype}` : ''}
        </span>

        {(onEdit || onDelete) && (
          <div className="mt-1 flex items-center gap-1.5">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(device)}
                aria-label={`Edit ${device.brand} ${device.name}`}
                className={smallButton}
              >
                Edit
              </button>
            )}
            {onDelete &&
              (confirmingDelete ? (
                <>
                  <button
                    type="button"
                    onClick={() => onDelete(device.id)}
                    aria-label={`Confirm delete ${device.brand} ${device.name}`}
                    className="rounded px-1 py-0.5 text-xs font-medium text-status-critical-text hover:underline"
                  >
                    Delete it?
                  </button>
                  <button type="button" onClick={() => setConfirmingDelete(false)} className={smallButton}>
                    Keep
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  aria-label={`Delete ${device.brand} ${device.name}`}
                  className={smallButton}
                >
                  Delete
                </button>
              ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {/* Spec reports go to Soundorp; a device the user made themselves isn't ours to correct. */}
        {!device.isCustom && <ReportSpecButton device={device} />}
        <button
          type="button"
          onClick={() => onAdd(device.id)}
          aria-label={`Add ${device.brand} ${device.name} to chain`}
          className="rounded-md border border-soundorp-border-card px-2.5 py-1 text-xs font-medium text-soundorp-text hover:bg-[#1f1f1f]"
        >
          Add
        </button>
      </div>
    </div>
  )
}
