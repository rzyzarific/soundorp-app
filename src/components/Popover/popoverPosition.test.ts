import { describe, expect, it } from 'vitest'
import {
  ANCHOR_GAP,
  EDGE_MARGIN,
  POPOVER_MAX_WIDTH,
  computePopoverPosition,
  type Box,
  type Insets,
  type PopoverPlacement,
  type Size,
} from './popoverPosition'

const box = (left: number, top: number, w = 20, h = 20): Box => ({ left, top, right: left + w, bottom: top + h })
const inside = (p: PopoverPlacement, size: Size, vp: Size, insets?: Partial<Insets>) => {
  const top = (insets?.top ?? 0) + EDGE_MARGIN
  const height = Math.min(size.height, p.maxHeight)
  return (
    p.left >= (insets?.left ?? 0) + EDGE_MARGIN &&
    p.left + p.width <= vp.width - (insets?.right ?? 0) - EDGE_MARGIN &&
    p.top >= top &&
    p.top + height <= vp.height - (insets?.bottom ?? 0) - EDGE_MARGIN + 0.001
  )
}

describe('computePopoverPosition', () => {
  const vp: Size = { width: 1000, height: 800 }
  const size: Size = { width: 256, height: 160 }

  it('opens below the anchor, right edges aligned, when there is room', () => {
    const anchor = box(500, 100)
    const p = computePopoverPosition(anchor, size, vp)
    expect(p.placement).toBe('below')
    expect(p.top).toBe(anchor.bottom + ANCHOR_GAP)
    expect(p.left + p.width).toBe(anchor.right)
    expect(p.width).toBe(256)
  })

  it('flips above when it does not fit below', () => {
    const anchor = box(500, 700)
    const p = computePopoverPosition(anchor, size, vp)
    expect(p.placement).toBe('above')
    expect(p.top + size.height).toBe(anchor.top - ANCHOR_GAP)
    expect(inside(p, size, vp)).toBe(true)
  })

  it('shifts right when the anchor is at the left edge (the clipped-popover case)', () => {
    const anchor = box(12, 100)
    const p = computePopoverPosition(anchor, size, vp)
    expect(p.left).toBe(EDGE_MARGIN)
    expect(inside(p, size, vp)).toBe(true)
  })

  it('shifts left when the anchor is at the right edge', () => {
    const anchor = box(vp.width - 24, 100)
    const p = computePopoverPosition(anchor, size, vp)
    expect(p.left + p.width).toBe(vp.width - EDGE_MARGIN)
    expect(inside(p, size, vp)).toBe(true)
  })

  it('stays on screen for an anchor in each corner', () => {
    for (const [x, y] of [[0, 0], [vp.width - 20, 0], [0, vp.height - 20], [vp.width - 20, vp.height - 20]]) {
      const p = computePopoverPosition(box(x, y), size, vp)
      expect(inside(p, size, vp)).toBe(true)
    }
  })

  it('narrows to fit a 320px phone, and never exceeds the maximum width', () => {
    const phone: Size = { width: 320, height: 640 }
    const p = computePopoverPosition(box(40, 100), { width: 400, height: 100 }, phone)
    expect(p.width).toBe(320 - 2 * EDGE_MARGIN)
    expect(p.left).toBe(EDGE_MARGIN)
    const wide = computePopoverPosition(box(500, 100), { width: 900, height: 100 }, vp)
    expect(wide.width).toBe(POPOVER_MAX_WIDTH)
  })

  it('takes the roomier side and scrolls inside itself when the content is taller than either side', () => {
    const tall: Size = { width: 256, height: 700 }
    const anchor = box(500, 300)
    const p = computePopoverPosition(anchor, tall, vp)
    // below: 800 - 8 - (320 + 8) = 464; above: 300 - 8 - 8 = 284
    expect(p.placement).toBe('below')
    expect(p.maxHeight).toBe(464)
    expect(inside(p, tall, vp)).toBe(true)
    const high = computePopoverPosition(box(500, 520), tall, vp)
    // below: 800 - 8 - 548 = 244; above: 520 - 8 - 8 = 504
    expect(high.placement).toBe('above')
    expect(high.maxHeight).toBe(504)
    expect(high.top).toBe(520 - ANCHOR_GAP - 504)
    expect(inside(high, tall, vp)).toBe(true)
  })

  it('keeps clear of a sticky navbar at the top', () => {
    const insets = { top: 56, right: 0, bottom: 0, left: 0 }
    const anchor = box(500, 90) // just under the navbar
    const p = computePopoverPosition(anchor, { width: 256, height: 700 }, vp, insets)
    expect(p.top).toBeGreaterThanOrEqual(56 + EDGE_MARGIN)
    const above = computePopoverPosition(box(500, 700), { width: 256, height: 400 }, vp, insets)
    expect(above.placement).toBe('above')
    expect(above.top).toBeGreaterThanOrEqual(56 + EDGE_MARGIN)
    expect(inside(above, { width: 256, height: 400 }, vp, insets)).toBe(true)
  })

  it('pins over the page when both sides are cramped (320x400 with a tall anchor)', () => {
    const tiny: Size = { width: 320, height: 400 }
    const anchor: Box = { left: 100, top: 100, right: 180, bottom: 300 }
    const p = computePopoverPosition(anchor, { width: 256, height: 300 }, tiny)
    // below: 400 - 8 - 308 = 84; above: 100 - 8 - 8 = 84, both under the usable minimum
    expect(p.placement).toBe('overlay')
    expect(p.top).toBe(EDGE_MARGIN)
    expect(p.maxHeight).toBe(400 - 2 * EDGE_MARGIN)
    expect(inside(p, { width: 256, height: 300 }, tiny)).toBe(true)
  })

  it('never lets a short popover be taller than its content allows', () => {
    const p = computePopoverPosition(box(500, 100), { width: 200, height: 40 }, vp)
    expect(p.placement).toBe('below')
    expect(p.maxHeight).toBeGreaterThanOrEqual(40)
  })
})
