import { useChainStore } from '../../store/useChainStore'
import { CHECKOUT_URL } from '../../lib/licensing'
import { trackEvent } from '../../lib/analytics'
import { PRO_BENEFITS, PRO_FEATURE_COPY } from '../../lib/proFeatures'
import { LicenseKeyForm } from './LicenseKeyForm'
import { Modal } from './Modal'

export function UpgradeModal() {
  const feature = useChainStore((s) => s.upgradeModalFeature)
  const closeUpgradeModal = useChainStore((s) => s.closeUpgradeModal)

  if (feature === null) return null
  const copy = PRO_FEATURE_COPY[feature]

  return (
    <Modal onClose={closeUpgradeModal} labelledBy="upgrade-modal-title">
      <h2 id="upgrade-modal-title" className="pr-8 font-orbitron text-base font-black text-soundorp-text">
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
    </Modal>
  )
}
