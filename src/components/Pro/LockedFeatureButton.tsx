import { useChainStore } from '../../store/useChainStore'
import type { ProFeature } from '../../lib/proFeatures'
import { ProBadge } from './ProBadge'

interface LockedFeatureButtonProps {
  feature: ProFeature
  children: string
}

// Free-tier stand-in for a Pro action: same footprint as the real button, but opens
// the upgrade modal instead of doing the work.
export function LockedFeatureButton({ feature, children }: LockedFeatureButtonProps) {
  const openUpgradeModal = useChainStore((s) => s.openUpgradeModal)

  return (
    <button
      type="button"
      onClick={() => openUpgradeModal(feature)}
      aria-haspopup="dialog"
      className="flex items-center gap-1.5 rounded-md border border-soundorp-border px-3 py-1.5 text-sm font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
    >
      {children}
      <ProBadge />
    </button>
  )
}
