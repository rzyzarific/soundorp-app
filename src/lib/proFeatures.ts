// Features that can open the upgrade modal. Add a key here when a new Pro-gated
// feature ships; only list benefits below that actually exist.
export type ProFeature = 'pdf_export' | 'unlimited_chains' | 'custom_devices' | 'shopping_list'

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
  shopping_list: {
    heading: 'Plan your budget with Pro',
    description:
      'Add up what your chain costs, set a budget, and see cheaper alternatives for each device that keep every compatibility check intact.',
  },
  custom_devices: {
    heading: 'Add unlimited custom devices with Pro',
    description:
      "Free accounts can add one custom device. Pro removes the limit, so every mic, interface and speaker that isn't in the catalog can go into your chains.",
  },
}

export const PRO_BENEFITS: string[] = [
  'Unlimited saved chains',
  'Unlimited custom devices',
  'Shopping list with a budget and cheaper alternatives',
  'PDF export of your chain and compatibility report',
]
