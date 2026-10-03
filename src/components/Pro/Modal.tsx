import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  onClose: () => void
  // id of the element inside `children` that titles the dialog.
  labelledBy: string
  widthClass?: string
  children: ReactNode
}

/** Dialog shell: backdrop, Escape and backdrop-click to close, focus moved in and restored. */
export function Modal({ onClose, labelledBy, widthClass = 'max-w-md', children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // Read through a ref so a parent passing a fresh inline onClose on every render (a form
  // re-renders per keystroke) doesn't re-run the effect and pull focus out of the field.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`relative max-h-full w-full ${widthClass} overflow-y-auto rounded-xl border border-soundorp-border bg-soundorp-panel p-5 shadow-lg outline-none`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md px-2 py-1 text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}
