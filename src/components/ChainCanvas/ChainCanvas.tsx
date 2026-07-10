import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Device } from '../../data/devices.schema'
import type { ConnectionCheckResult } from '../../engine/types'
import { useChainStore } from '../../store/useChainStore'
import { DeviceNode } from './DeviceNode'
import { Connector } from './Connector'

interface ChainCanvasProps {
  devices: Device[]
  connections: ConnectionCheckResult[]
}

interface Slot {
  slotId: string
  device: Device
}

interface SortableDeviceNodeProps {
  slot: Slot
  index: number
  onRemove: (index: number) => void
}

function SortableDeviceNode({ slot, index, onRemove }: SortableDeviceNodeProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slot.slotId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative" {...attributes} {...listeners}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove(index)
        }}
        className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-soundorp-border-card bg-soundorp-bg text-xs text-soundorp-muted shadow hover:text-soundorp-red"
        aria-label={`Remove ${slot.device.name}`}
      >
        ×
      </button>
      <DeviceNode device={slot.device} />
    </div>
  )
}

export function ChainCanvas({ devices, connections }: ChainCanvasProps) {
  const removeDevice = useChainStore((s) => s.removeDevice)
  const reorderDevice = useChainStore((s) => s.reorderDevice)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const slots: Slot[] = devices.map((device, i) => ({ slotId: `${device.id}-${i}`, device }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const fromIndex = slots.findIndex((s) => s.slotId === active.id)
    const toIndex = slots.findIndex((s) => s.slotId === over.id)
    if (fromIndex === -1 || toIndex === -1) return

    reorderDevice(fromIndex, toIndex)
  }

  if (devices.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-soundorp-border bg-soundorp-panel p-10 text-sm text-soundorp-muted">
        Add a device from the library to start building your chain.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-soundorp-border bg-soundorp-panel p-6">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slots.map((s) => s.slotId)} strategy={horizontalListSortingStrategy}>
          <div className="flex items-center gap-0">
            {slots.map((slot, i) => (
              <div key={slot.slotId} className="flex items-center">
                <SortableDeviceNode slot={slot} index={i} onRemove={removeDevice} />
                {i < slots.length - 1 && <Connector connection={connections[i]} />}
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
