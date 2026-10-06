import { useEffect, useId, useRef, useState } from 'react'
import { BRAND_LINK, CURRENT_SECTION, LINK_REL, LINK_TARGET, NAV_LINKS } from './navLinks'

// Full navigation from this width up; below it, the links live behind a button.
const WIDE_QUERY = '(min-width: 768px)'

const LINK_CLASS =
  'inline-flex min-h-11 items-center font-orbitron text-xs font-bold uppercase tracking-[0.6px] text-soundorp-text outline-none hover:text-soundorp-red focus-visible:text-soundorp-red focus-visible:underline'

function NewTabHint() {
  return <span className="sr-only"> (opens in a new tab)</span>
}

/**
 * The bar across the top of every page, back to soundorp.com. Sticky; it carries
 * data-sticky-top so popovers know to stay clear of it.
 */
export function Navbar() {
  const [open, setOpen] = useState(false)
  const barRef = useRef<HTMLElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return

    function closeAndReturnFocus() {
      setOpen(false)
      buttonRef.current?.focus()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeAndReturnFocus()
    }
    function onPointerDown(e: PointerEvent) {
      if (!barRef.current?.contains(e.target as Node)) setOpen(false)
    }
    // Widening the window past the breakpoint turns the menu into the inline links.
    const wide = window.matchMedia(WIDE_QUERY)
    function onWiden(e: MediaQueryListEvent) {
      if (e.matches) setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    wide.addEventListener('change', onWiden)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      wide.removeEventListener('change', onWiden)
    }
  }, [open])

  return (
    <header
      data-sticky-top
      className="sticky top-0 z-40 border-b border-soundorp-border bg-soundorp-bg px-6"
    >
      {/* Same gutter and max width as the page below, so the bar lines up with the content. */}
      <nav
        ref={barRef}
        aria-label="soundorp"
        className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <a
            href={BRAND_LINK.href}
            target={LINK_TARGET}
            rel={LINK_REL}
            className="inline-flex min-h-11 items-center font-orbitron text-lg font-black lowercase text-soundorp-red outline-none hover:underline focus-visible:underline"
          >
            {BRAND_LINK.label}
            <NewTabHint />
          </a>
          {/* Where you are, in the bar from 640px; on phones it heads the menu instead. */}
          <span
            aria-current="page"
            className="hidden border-b-2 border-soundorp-red py-1 font-orbitron text-xs font-bold uppercase tracking-[0.6px] text-soundorp-muted sm:inline"
          >
            {CURRENT_SECTION}
          </span>
        </div>

        <ul className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} target={LINK_TARGET} rel={LINK_REL} className={LINK_CLASS}>
                {link.label}
                <NewTabHint />
              </a>
            </li>
          ))}
        </ul>

        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-soundorp-border text-soundorp-text hover:bg-[#1f1f1f] md:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M3 3l12 12M15 3L3 15" /> : <path d="M2 4.5h14M2 9h14M2 13.5h14" />}
          </svg>
        </button>

        {open && (
          <ul
            id={menuId}
            className="absolute inset-x-0 top-full flex flex-col border-b border-soundorp-border bg-soundorp-bg px-6 pb-3 md:hidden"
          >
            <li className="sm:hidden">
              <span
                aria-current="page"
                className="my-1 inline-flex min-h-11 items-center border-l-2 border-soundorp-red pl-3 font-orbitron text-xs font-bold uppercase tracking-[0.6px] text-soundorp-muted"
              >
                {CURRENT_SECTION}
              </span>
            </li>
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target={LINK_TARGET}
                  rel={LINK_REL}
                  onClick={() => setOpen(false)}
                  className={`${LINK_CLASS} w-full`}
                >
                  {link.label}
                  <NewTabHint />
                </a>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </header>
  )
}
