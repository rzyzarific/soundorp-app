import { useEffect, useRef } from 'react'
import { useChainStore } from '../../store/useChainStore'
import { CHECKOUT_URL } from '../../lib/licensing'
import { trackEvent } from '../../lib/analytics'
import { PRO_BENEFITS, PRO_FEATURE_COPY } from '../../lib/proFeatures'
import { LicenseKeyForm } from './LicenseKeyForm'

export function UpgradeModal() {
  const feature = useChainStore((s) => s.upgradeModalFeature)
  const closeUpgradeModal = useChainStore((s) => s.closeUpgradeModal)
  const panelRef = useRef<HTMLDivElement>(null)
  const isOpen = feature !== null

  useEffect(() => {
    if (!isOpen) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeUpgradeModal()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [isOpen, closeUpgradeModal])

  if (feature === null) return null
  const copy = PRO_FEATURE_COPY[feature]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={closeUpgradeModal}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-soundorp-border bg-soundorp-panel p-5 shadow-lg outline-none"
      >
        <button
          type="button"
          onClick={closeUpgradeModal}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md px-2 py-1 text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
        >
          ✕
        </button>

        <h2
          id="upgrade-modal-title"
          className="pr-8 font-orbitron text-base font-black text-soundorp-text"
        >
          {copy.heading}
        </h2>
        <p className="mt-2 text-sm text-soundorp-muted">{copy.description}</p>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-soundorp-muted">
          Pro includes
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {PRO_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex gap-2 text-sm text-soundorp-text">
              <span aria-hidden="true" className="text-status-pass-text">
                ✓
              </span>
              {benefit}
            </li>
          ))}
        </ul>

        <a
          href={CHECKOUT_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('checkout_open', { source: 'upgrade_modal', feature })}
          className="mt-5 block rounded-md bg-soundorp-red px-3 py-2 text-center text-sm font-medium text-white hover:bg-soundorp-red/90"
        >
          Get Pro
        </a>

        <div className="mt-5 border-t border-soundorp-border pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-soundorp-muted">
            Already have a key?
          </p>
          <LicenseKeyForm />
        </div>
      </div>
    </div>
  )
}
