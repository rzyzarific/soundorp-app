// Features that can open the upgrade modal. Add a key here when a new Pro-gated
// feature ships; only list benefits below that actually exist.
export type ProFeature = 'pdf_export' | 'unlimited_chains'

export const PRO_FEATURE_COPY: Record<ProFeature, { heading: string; description: string }> = {
  unlimited_chains: {
    heading: 'Save unlimited chains with Pro',
    description:
      'Free accounts can keep one saved chain at a time. Pro lets you save as many chains as you like, so you can keep a rig for every show, stream or session.',
  },
  pdf_export: {
    heading: 'PDF export is a Pro feature',
    description:
      'Download your signal chain and its full compatibility report as a printable PDF to keep, share with a client, or take shopping.',
  },
}

export const PRO_BENEFITS: string[] = [
  'Unlimited saved chains',
  'PDF export of your chain and compatibility report',
]
