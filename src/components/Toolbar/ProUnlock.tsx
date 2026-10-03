import { useState } from 'react'
import { useChainStore } from '../../store/useChainStore'
import { CHECKOUT_URL } from '../../lib/licensing'
import { trackEvent } from '../../lib/analytics'
import { LicenseKeyForm } from '../Pro/LicenseKeyForm'

export function ProUnlock() {
  const isPro = useChainStore((s) => s.isPro)
  const clearLicenseError = useChainStore((s) => s.clearLicenseError)

  const [open, setOpen] = useState(false)

  if (isPro) {
    return (
      <span className="rounded-md border border-green-600 bg-green-900/40 px-3 py-1.5 text-sm font-medium text-green-400">
        Pro ✓
      </span>
    )
  }

  function handleToggle() {
    clearLicenseError()
    setOpen((v) => !v)
  }

  return (
    <>
      <a
        href={CHECKOUT_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent('checkout_open', { source: 'toolbar' })}
        className="rounded-md border border-soundorp-red px-3 py-1.5 text-sm font-medium text-soundorp-red hover:bg-soundorp-red/10"
      >
        Get Pro
      </a>
      <div className="relative">
        <button
          type="button"
          onClick={handleToggle}
          className={
            open
              ? 'rounded-md border border-soundorp-border bg-[#2a2a2a] px-3 py-1.5 text-sm font-medium text-soundorp-text'
              : 'rounded-md border border-soundorp-border px-3 py-1.5 text-sm font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text'
          }
        >
          I have a key
        </button>
        {open && (
          <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-soundorp-border bg-soundorp-panel p-3 shadow-lg">
            <LicenseKeyForm autoFocus onCancel={handleToggle} onActivated={() => setOpen(false)} />
          </div>
        )}
      </div>
    </>
  )
}
