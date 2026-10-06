import { useEffect, useRef, useState } from 'react'
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
    // touch-pan-y: a finger moving along the card is a drag (the browser leaves horizontal
    // movement to the drag sensor instead of scrolling the row), while moving up or down still
    // scrolls the page. The row itself scrolls from its padding and from the gaps between cards.
    <div ref={setNodeRef} style={style} className="relative touch-pan-y" {...attributes} {...listeners}>
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

const FADE_MASK =
  '[mask-image:linear-gradient(to_right,black_92%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,black_92%,transparent_100%)]'

export function ChainCanvas({ devices, connections }: ChainCanvasProps) {
  const removeDevice = useChainStore((s) => s.removeDevice)
  const reorderDevice = useChainStore((s) => s.reorderDevice)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // The right-edge fade hints that there is more to scroll to; once the row is scrolled to its end
  // (or fits) it would only make the last card look disabled, so it comes off.
  const rowRef = useRef<HTMLDivElement>(null)
  const [moreToRight, setMoreToRight] = useState(false)
  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const update = () => setMoreToRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 1)
    update()
    row.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      row.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [devices.length])

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
    <div
      ref={rowRef}
      className={`min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-soundorp-border bg-soundorp-panel p-6 ${moreToRight ? FADE_MASK : ''}`}
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slots.map((s) => s.slotId)} strategy={horizontalListSortingStrategy}>
          <div className="flex w-max items-center gap-0">
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
