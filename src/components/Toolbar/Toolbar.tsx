import { useRef, useState } from 'react'
import { useChainStore } from '../../store/useChainStore'
import { encodeChainToShareParam } from '../../lib/share'
import { SavedChains } from '../SavedChains/SavedChains'
import { ProUnlock } from './ProUnlock'

export function Toolbar() {
  const currentChain = useChainStore((s) => s.currentChain)
  const newChain = useChainStore((s) => s.newChain)
  const saveCurrentChain = useChainStore((s) => s.saveCurrentChain)
  const renameCurrentChain = useChainStore((s) => s.renameCurrentChain)
  const saveError = useChainStore((s) => s.saveError)
  const clearSaveError = useChainStore((s) => s.clearSaveError)

  const [savedChainsOpen, setSavedChainsOpen] = useState(false)
  const [shareConfirmation, setShareConfirmation] = useState(false)
  const [shareFallbackUrl, setShareFallbackUrl] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const fallbackInputRef = useRef<HTMLInputElement>(null)

  async function handleShare() {
    const encoded = encodeChainToShareParam(currentChain)
    const url = `${window.location.origin}${window.location.pathname}?chain=${encoded}`

    try {
      await navigator.clipboard.writeText(url)
      setShareFallbackUrl(null)
      setShareConfirmation(true)
      setTimeout(() => setShareConfirmation(false), 2000)
    } catch {
      setShareConfirmation(false)
      setShareFallbackUrl(url)
      // Give the input a tick to mount before selecting its text.
      setTimeout(() => fallbackInputRef.current?.select(), 0)
    }
  }

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

      <div className="flex flex-wrap items-center gap-2">
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
          {saveError && (
            <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-status-warning-border bg-status-warning-bg p-3 shadow-lg">
              <p className="text-xs text-status-warning-text">{saveError}</p>
              <button
                type="button"
                onClick={clearSaveError}
                className="mt-2 rounded-md border border-soundorp-border px-2 py-1 text-xs font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={handleShare}
            className="rounded-md bg-soundorp-red px-3 py-1.5 text-sm font-medium text-white hover:bg-soundorp-red/90"
          >
            {shareConfirmation ? 'Link copied!' : 'Share'}
          </button>
          {shareFallbackUrl && (
            <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-soundorp-border bg-soundorp-panel p-3 shadow-lg">
              <p className="mb-2 text-xs text-soundorp-muted">
                Couldn't copy automatically — select and copy this link manually:
              </p>
              <div className="flex gap-1.5">
                <input
                  ref={fallbackInputRef}
                  type="text"
                  readOnly
                  value={shareFallbackUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-md border border-soundorp-border bg-soundorp-bg px-2 py-1 text-xs text-soundorp-text outline-none focus:border-soundorp-red"
                />
                <button
                  type="button"
                  onClick={() => setShareFallbackUrl(null)}
                  className="shrink-0 rounded-md border border-soundorp-border px-2 py-1 text-xs font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setSavedChainsOpen((open) => !open)}
            className={
              savedChainsOpen
                ? 'rounded-md border border-soundorp-border bg-[#2a2a2a] px-3 py-1.5 text-sm font-medium text-soundorp-text'
                : 'rounded-md border border-soundorp-border px-3 py-1.5 text-sm font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text'
            }
          >
            Saved chains
          </button>
          {savedChainsOpen && <SavedChains onClose={() => setSavedChainsOpen(false)} />}
        </div>
      </div>
    </div>
  )
}
