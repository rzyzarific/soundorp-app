import { track } from '@vercel/analytics'

export type AnalyticsEvent = 'locked_feature_click' | 'checkout_open' | 'license_activated'

type EventProps = Record<string, string | number | boolean>

// Analytics must never break the app (ad blockers, SSR/test environments), so every
// call is swallowed on failure.
export function trackEvent(name: AnalyticsEvent, props?: EventProps): void {
  try {
    track(name, props)
  } catch {
    // ignore
  }
}
