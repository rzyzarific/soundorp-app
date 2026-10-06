import { useRef, useState } from 'react'
import { useChainStore } from '../../store/useChainStore'
import { CHECKOUT_URL } from '../../lib/licensing'
import { trackEvent } from '../../lib/analytics'
import { LicenseKeyForm } from '../Pro/LicenseKeyForm'
import { Popover } from '../Popover/Popover'

export function ProUnlock() {
  const isPro = useChainStore((s) => s.isPro)
  const clearLicenseError = useChainStore((s) => s.clearLicenseError)

  const [open, setOpen] = useState(false)
  const keyButtonRef = useRef<HTMLButtonElement>(null)

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

  function handleClose() {
    clearLicenseError()
    setOpen(false)
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
          ref={keyButtonRef}
          type="button"
          onClick={handleToggle}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={
            open
              ? 'rounded-md border border-soundorp-border bg-[#2a2a2a] px-3 py-1.5 text-sm font-medium text-soundorp-text'
              : 'rounded-md border border-soundorp-border px-3 py-1.5 text-sm font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text'
          }
        >
          I have a key
        </button>
        <Popover
          open={open}
          onClose={handleClose}
          anchorRef={keyButtonRef}
          label="Activate a license key"
          widthClass="w-80"
        >
          <LicenseKeyForm autoFocus onCancel={handleClose} onActivated={() => setOpen(false)} />
        </Popover>
      </div>
    </>
  )
}
