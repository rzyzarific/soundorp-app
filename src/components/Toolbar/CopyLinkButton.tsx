import { useRef, useState } from 'react'

interface CopyLinkButtonProps {
  label: string
  // Shown for a couple of seconds after the link is copied.
  copiedLabel: string
  // Built when clicked, so the link always reflects the chain as it is right then.
  getUrl: () => string
  primary?: boolean
}

const PRIMARY = 'rounded-md bg-soundorp-red px-3 py-1.5 text-sm font-medium text-white hover:bg-soundorp-red/90'
const SECONDARY =
  'rounded-md border border-soundorp-border px-3 py-1.5 text-sm font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text'

/** Copies a link to the clipboard; if the browser refuses, shows it to select and copy by hand. */
export function CopyLinkButton({ label, copiedLabel, getUrl, primary = false }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const fallbackInputRef = useRef<HTMLInputElement>(null)

  async function handleClick() {
    const url = getUrl()

    try {
      await navigator.clipboard.writeText(url)
      setFallbackUrl(null)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
      setFallbackUrl(url)
      // Give the input a tick to mount before selecting its text.
      setTimeout(() => fallbackInputRef.current?.select(), 0)
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={handleClick} className={primary ? PRIMARY : SECONDARY}>
        {copied ? copiedLabel : label}
      </button>
      {fallbackUrl && (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-soundorp-border bg-soundorp-panel p-3 shadow-lg">
          <p className="mb-2 text-xs text-soundorp-muted">
            Couldn't copy automatically — select and copy this link manually:
          </p>
          <div className="flex gap-1.5">
            <input
              ref={fallbackInputRef}
              type="text"
              readOnly
              value={fallbackUrl}
              aria-label="Link to copy"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-soundorp-border bg-soundorp-bg px-2 py-1 text-xs text-soundorp-text outline-none focus:border-soundorp-red"
            />
            <button
              type="button"
              onClick={() => setFallbackUrl(null)}
              className="shrink-0 rounded-md border border-soundorp-border px-2 py-1 text-xs font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
