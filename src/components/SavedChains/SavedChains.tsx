import { useChainStore } from '../../store/useChainStore'

interface SavedChainsProps {
  onClose: () => void
}

export function SavedChains({ onClose }: SavedChainsProps) {
  const savedChains = useChainStore((s) => s.savedChains)
  const loadChain = useChainStore((s) => s.loadChain)
  const deleteChain = useChainStore((s) => s.deleteChain)

  return (
    <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-soundorp-border bg-soundorp-panel p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-orbitron text-sm font-black uppercase tracking-[0.6px] text-soundorp-muted">
          Saved chains
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-soundorp-muted hover:text-soundorp-text"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {savedChains.length === 0 ? (
        <p className="text-sm text-soundorp-muted">No saved chains yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {savedChains
            .slice()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((chain) => (
              <li
                key={chain.id}
                className="flex items-center justify-between gap-2 rounded-md border border-soundorp-border px-3 py-2"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-soundorp-text">{chain.name}</span>
                  <span className="text-xs text-soundorp-muted">
                    {new Date(chain.updatedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => loadChain(chain.id)}
                    className="rounded-md border border-soundorp-border px-2 py-1 text-xs font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteChain(chain.id)}
                    className="rounded-md border border-soundorp-border px-2 py-1 text-xs font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
