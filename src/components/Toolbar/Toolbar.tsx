import { useRef, useState } from 'react'
import { useChainStore } from '../../store/useChainStore'
import { encodeChainToShareParam } from '../../lib/share'
import { buildPublicChainUrl } from '../../lib/publicLink'
import { customDevicesUsedBy } from '../../lib/customDevices'
import { CopyLinkButton } from './CopyLinkButton'
import { SavedChains } from '../SavedChains/SavedChains'
import { ProUnlock } from './ProUnlock'
import { ExportPdfButton } from '../PdfExport/ExportPdfButton'
import { LockedFeatureButton } from '../Pro/LockedFeatureButton'
import { Popover } from '../Popover/Popover'

export function Toolbar() {
  const currentChain = useChainStore((s) => s.currentChain)
  const customLibrary = useChainStore((s) => s.customDevices)
  const newChain = useChainStore((s) => s.newChain)
  const saveCurrentChain = useChainStore((s) => s.saveCurrentChain)
  const renameCurrentChain = useChainStore((s) => s.renameCurrentChain)
  const isPro = useChainStore((s) => s.isPro)
  const saveError = useChainStore((s) => s.saveError)
  const clearSaveError = useChainStore((s) => s.clearSaveError)
  const openUpgradeModal = useChainStore((s) => s.openUpgradeModal)

  const [savedChainsOpen, setSavedChainsOpen] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const saveButtonRef = useRef<HTMLButtonElement>(null)
  const savedChainsButtonRef = useRef<HTMLButtonElement>(null)

  // Both links carry the same self-contained payload, which has to include the specs of any
  // custom devices, since whoever opens it has never seen them.
  function encodeCurrentChain(): string {
    const customDevices = customDevicesUsedBy(
      currentChain.deviceIds,
      customLibrary,
      currentChain.customDevices,
    )
    return encodeChainToShareParam({ ...currentChain, customDevices })
  }

  // Opens the builder with a copy of this chain to edit.
  const getShareUrl = () =>
    `${window.location.origin}${window.location.pathname}?chain=${encodeCurrentChain()}`
  // Opens a read-only page that never expires, with nothing to sign in to or install.
  const getPublicUrl = () => buildPublicChainUrl(window.location.origin, encodeCurrentChain())

  function handleSave() {
    saveCurrentChain()
    // saveCurrentChain is a synchronous zustand set(), so the store already
    // reflects the outcome here — only show success when it wasn't rejected
    // by the free-tier cap (that case has its own error popover).
    if (useChainStore.getState().saveError === null) {
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-soundorp-border bg-soundorp-panel px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <input
        type="text"
        value={currentChain.name}
        onChange={(e) => renameCurrentChain(e.target.value)}
        className="w-full min-w-0 rounded-md border border-transparent px-2 py-1 text-sm font-semibold text-soundorp-text outline-none hover:border-soundorp-border focus:border-soundorp-red sm:flex-1"
      />

      {/* .toolbar-actions (index.css): a 2-column grid of 44px controls on phones, wrapping row above. */}
      <div className="toolbar-actions grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <ProUnlock />
        <button
          type="button"
          onClick={newChain}
          className="rounded-md border border-soundorp-border px-3 py-1.5 text-sm font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
        >
          New chain
        </button>
        <div className="relative">
          <button
            ref={saveButtonRef}
            type="button"
            onClick={handleSave}
            className={
              justSaved
                ? 'rounded-md border border-green-600 bg-green-900/40 px-3 py-1.5 text-sm font-medium text-green-400'
                : 'rounded-md border border-soundorp-border px-3 py-1.5 text-sm font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text'
            }
          >
            {justSaved ? 'Saved ✓' : 'Save'}
          </button>
          <Popover
            open={saveError !== null}
            onClose={clearSaveError}
            anchorRef={saveButtonRef}
            label="Saved chain limit"
            widthClass="w-72"
            surfaceClass="border-status-warning-border bg-status-warning-bg"
          >
            <p className="text-xs text-status-warning-text">{saveError}</p>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  clearSaveError()
                  openUpgradeModal('unlimited_chains')
                }}
                aria-haspopup="dialog"
                className="rounded-md bg-soundorp-red px-2 py-1 text-xs font-medium text-white hover:bg-soundorp-red/90"
              >
                Upgrade to Pro
              </button>
              <button
                type="button"
                onClick={clearSaveError}
                className="rounded-md border border-soundorp-border px-2 py-1 text-xs font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
              >
                Dismiss
              </button>
            </div>
          </Popover>
        </div>
        <CopyLinkButton label="Share" copiedLabel="Link copied!" getUrl={getShareUrl} primary />
        <CopyLinkButton
          label="Copy permanent link"
          copiedLabel="Link copied!"
          getUrl={getPublicUrl}
        />
        {isPro ? (
          <ExportPdfButton />
        ) : (
          <LockedFeatureButton feature="pdf_export">Export PDF</LockedFeatureButton>
        )}
        <div className="relative">
          <button
            ref={savedChainsButtonRef}
            type="button"
            onClick={() => setSavedChainsOpen((open) => !open)}
            aria-haspopup="dialog"
            aria-expanded={savedChainsOpen}
            className={
              savedChainsOpen
                ? 'rounded-md border border-soundorp-border bg-[#2a2a2a] px-3 py-1.5 text-sm font-medium text-soundorp-text'
                : 'rounded-md border border-soundorp-border px-3 py-1.5 text-sm font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text'
            }
          >
            Saved chains
          </button>
          {savedChainsOpen && (
            <SavedChains onClose={() => setSavedChainsOpen(false)} anchorRef={savedChainsButtonRef} />
          )}
        </div>
      </div>
    </div>
  )
}
