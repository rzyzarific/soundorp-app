import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Modal } from '../Pro/Modal'
import { computePopoverPosition } from './popoverPosition'

// Below this width a popover becomes a centered modal: an anchored box has no room to sit
// beside its trigger, and a modal copes with the on-screen keyboard better than a bottom sheet.
const SHEET_QUERY = '(max-width: 639px)'

function subscribeToSheetQuery(onChange: () => void) {
  const query = window.matchMedia(SHEET_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function useIsSheet(): boolean {
  return useSyncExternalStore(
    subscribeToSheetQuery,
    () => window.matchMedia(SHEET_QUERY).matches,
    () => false,
  )
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// A pointer-down or click inside a popover is nothing to do with whatever it was opened from.
// React events bubble through portals to the *React* parent, so without this a press inside the
// report form on a chain card would reach the card's drag handle (dnd-kit listens on pointerdown).
function stopBubbling(e: SyntheticEvent) {
  e.stopPropagation()
}

// The bottom edge of anything stuck to the top of the screen (the navbar), which a popover must
// stay clear of. Found by attribute so Popover needs no knowledge of the navbar itself.
function stickyTopInset(): number {
  let inset = 0
  for (const el of document.querySelectorAll('[data-sticky-top]')) {
    inset = Math.max(inset, el.getBoundingClientRect().bottom)
  }
  return Math.max(0, inset)
}

// False once the trigger has been scrolled out of sight, either off the screen or out of the
// scroll container it lives in. Only then does a popover have nothing left to point at.
function isAnchorVisible(anchor: HTMLElement, rect: DOMRect, topInset: number): boolean {
  const overlaps = (r: { left: number; right: number; top: number; bottom: number }) =>
    rect.right > r.left && rect.left < r.right && rect.bottom > r.top && rect.top < r.bottom
  if (!overlaps({ left: 0, right: window.innerWidth, top: topInset, bottom: window.innerHeight })) return false
  for (let el = anchor.parentElement; el && el !== document.body; el = el.parentElement) {
    const style = getComputedStyle(el)
    if (style.overflowX === 'visible' && style.overflowY === 'visible') continue
    if (!overlaps(el.getBoundingClientRect())) return false
  }
  return true
}

interface PopoverProps {
  open: boolean
  onClose: () => void
  // The trigger. Not part of "outside" for click purposes, and focus returns to it on close.
  anchorRef: RefObject<HTMLElement | null>
  // Names the dialog for assistive technology.
  label: string
  // Width of the anchored box on larger screens (a Tailwind width class).
  widthClass?: string
  // Colours of the anchored box, to match its content (e.g. a warning).
  surfaceClass?: string
  // The content has its own close control, so the centered-modal version omits its own.
  ownClose?: boolean
  children: ReactNode
}

/**
 * A floating panel that is always fully on screen, wherever its trigger sits.
 *
 * It is rendered into <body> with `position: fixed` and placed from the trigger's bounding
 * rectangle, so no `overflow` or `transform` ancestor can clip it. It flips and shifts to stay
 * inside the viewport, scrolls internally on short screens, and closes on Escape, an outside
 * press, a change of window width, or when the trigger scrolls out of sight. On phones it is a
 * centered modal instead.
 */
export function Popover(props: PopoverProps) {
  const sheet = useIsSheet()
  if (!props.open) return null
  return sheet ? <SheetPopover {...props} /> : <AnchoredPopover {...props} />
}

function AnchoredPopover({
  onClose,
  anchorRef,
  label,
  widthClass = 'w-72',
  surfaceClass = 'border-soundorp-border bg-soundorp-panel',
  children,
}: PopoverProps) {
  const popRef = useRef<HTMLDivElement>(null)
  // Read through a ref so a parent's fresh inline onClose doesn't re-run the effect below.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  const place = useCallback(() => {
    const anchor = anchorRef.current
    const pop = popRef.current
    if (!anchor || !pop) return
    const rect = anchor.getBoundingClientRect()
    const topInset = stickyTopInset()
    if (!isAnchorVisible(anchor, rect, topInset)) {
      onCloseRef.current()
      return
    }
    // Measure the natural size: not squeezed by a previous placement. Lifting the height limit
    // makes the box un-scrollable for a moment, which would reset its own scroll position.
    const scrolled = pop.scrollTop
    pop.style.maxHeight = 'none'
    pop.style.width = ''
    const size = { width: pop.offsetWidth, height: pop.scrollHeight + (pop.offsetHeight - pop.clientHeight) }
    const placed = computePopoverPosition(
      rect,
      size,
      { width: document.documentElement.clientWidth, height: window.innerHeight },
      { top: topInset, right: 0, bottom: 0, left: 0 },
    )
    pop.style.left = `${placed.left}px`
    pop.style.top = `${placed.top}px`
    pop.style.width = `${placed.width}px`
    pop.style.maxHeight = `${placed.maxHeight}px`
    pop.scrollTop = scrolled
  }, [anchorRef])

  // Before the first paint, so it never flashes at 0,0.
  useLayoutEffect(() => {
    place()
  }, [place])

  useEffect(() => {
    const pop = popRef.current
    const trigger = anchorRef.current
    if (!pop) return

    // Into the popover: it sits at the end of <body>, where Tab from the trigger would never reach.
    const first = pop.querySelector<HTMLElement>('[data-autofocus]') ?? pop.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? pop).focus({ preventScroll: true })

    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(place)
    }
    // Only a change of *width* closes it: a soft keyboard changes the height, and closing then
    // would throw away a half-typed comment.
    let width = window.innerWidth
    const onResize = () => {
      if (window.innerWidth !== width) onCloseRef.current()
      else schedule()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (pop.contains(target) || trigger?.contains(target)) return
      onCloseRef.current()
    }
    // Capture phase for the document listeners: React stops events inside the popover from
    // bubbling, and that would otherwise hide them from a bubble-phase listener on document.
    window.addEventListener('resize', onResize)
    // Any scroll, of the page or of any container, can move the trigger; the popover's own
    // scrolling cannot.
    const onScroll = (e: Event) => {
      if (!pop.contains(e.target as Node)) schedule()
    }
    window.addEventListener('scroll', onScroll, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    const observer = new ResizeObserver(schedule)
    observer.observe(pop)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      observer.disconnect()
      // Back to the trigger, unless the person has already moved on to something else.
      const active = document.activeElement
      if (!active || active === document.body || pop.contains(active)) {
        trigger?.focus?.({ preventScroll: true })
      }
    }
  }, [place, anchorRef])

  // Keep Tab inside, like a dialog.
  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return
    const pop = popRef.current
    if (!pop) return
    const items = Array.from(pop.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (items.length === 0) {
      e.preventDefault()
      return
    }
    const firstItem = items[0]
    const lastItem = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === firstItem || active === pop)) {
      e.preventDefault()
      lastItem.focus()
    } else if (!e.shiftKey && (active === lastItem || active === pop)) {
      e.preventDefault()
      firstItem.focus()
    }
  }

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      onPointerDown={stopBubbling}
      onClick={stopBubbling}
      onKeyDown={handleKeyDown}
      style={{ position: 'fixed', left: 0, top: 0, maxWidth: 'min(360px, calc(100vw - 16px))' }}
      className={`z-[45] overflow-y-auto overscroll-contain rounded-xl border p-3 text-left shadow-lg outline-none ${widthClass} ${surfaceClass}`}
    >
      {children}
    </div>,
    document.body,
  )
}

function SheetPopover({ onClose, label, ownClose = false, children }: PopoverProps) {
  const titleId = useId()

  // Modal focuses its panel; a form inside should get the cursor instead.
  useEffect(() => {
    document
      .getElementById(titleId)
      ?.closest('[role="dialog"]')
      ?.querySelector<HTMLElement>('[data-autofocus]')
      ?.focus()
  }, [titleId])

  return (
    // `contents`: draws nothing here (the modal itself is portaled); it exists to stop presses on
    // the modal from reaching a drag handle further up the React tree.
    <div className="contents" onPointerDown={stopBubbling} onClick={stopBubbling}>
      <Modal onClose={onClose} labelledBy={titleId} widthClass="max-w-sm" hideClose={ownClose}>
        <h2 id={titleId} className="sr-only">
          {label}
        </h2>
        <div className={ownClose ? '' : 'pr-6'}>{children}</div>
      </Modal>
    </div>
  )
}
