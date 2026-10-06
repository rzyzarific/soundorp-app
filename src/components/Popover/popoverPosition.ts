// Where to put a popover so it is always fully on screen. Pure (numbers in, numbers out), so the
// edge cases can be unit-tested without a browser; Popover.tsx does the measuring and applying.

export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

export interface Size {
  width: number
  height: number
}

// Space taken from each viewport edge, e.g. a sticky navbar covering the top.
export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface PopoverPlacement {
  left: number
  top: number
  width: number
  // The room available on the chosen side; the popover scrolls inside itself beyond this.
  maxHeight: number
  placement: 'below' | 'above' | 'overlay'
}

/** Nothing may come closer than this to the edge of the screen. */
export const EDGE_MARGIN = 8
/** Gap between the trigger and the popover. */
export const ANCHOR_GAP = 8
export const POPOVER_MAX_WIDTH = 360
// Below this a side is too cramped to be useful, so the popover is pinned over the page instead.
const MIN_USABLE_HEIGHT = 120

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

/**
 * Places a popover of its natural `size` next to `anchor` inside `viewport`.
 *
 * Preferred: below the anchor with the right edges aligned. It shifts sideways to stay
 * EDGE_MARGIN inside the screen, flips above when it does not fit below, and when neither side
 * has room it takes the roomier side and scrolls inside itself (or, if both are cramped, is
 * pinned over the whole usable area).
 */
export function computePopoverPosition(
  anchor: Box,
  size: Size,
  viewport: Size,
  insets: Insets = NO_INSETS,
): PopoverPlacement {
  const minLeft = insets.left + EDGE_MARGIN
  const maxRight = viewport.width - insets.right - EDGE_MARGIN
  const minTop = insets.top + EDGE_MARGIN
  const maxBottom = viewport.height - insets.bottom - EDGE_MARGIN

  const width = Math.max(0, Math.min(size.width, POPOVER_MAX_WIDTH, maxRight - minLeft))
  const left = Math.min(Math.max(anchor.right - width, minLeft), maxRight - width)

  const spaceBelow = maxBottom - (anchor.bottom + ANCHOR_GAP)
  const spaceAbove = anchor.top - ANCHOR_GAP - minTop

  if (size.height <= spaceBelow) {
    return { left, top: anchor.bottom + ANCHOR_GAP, width, maxHeight: spaceBelow, placement: 'below' }
  }
  if (size.height <= spaceAbove) {
    return { left, top: anchor.top - ANCHOR_GAP - size.height, width, maxHeight: spaceAbove, placement: 'above' }
  }

  const below = spaceBelow >= spaceAbove
  const space = below ? spaceBelow : spaceAbove
  if (space < Math.min(size.height, MIN_USABLE_HEIGHT)) {
    const usable = Math.max(0, maxBottom - minTop)
    return { left, top: minTop, width, maxHeight: usable, placement: 'overlay' }
  }
  return below
    ? { left, top: anchor.bottom + ANCHOR_GAP, width, maxHeight: space, placement: 'below' }
    : { left, top: anchor.top - ANCHOR_GAP - space, width, maxHeight: space, placement: 'above' }
}
