import { track } from '@vercel/analytics'

/**
 * Page-view URLs for shared chains carry the whole chain in them. Collapse them to one path
 * so analytics isn't filled with a unique URL per chain (and doesn't store chain contents).
 */
export function scrubAnalyticsUrl(url: string): string {
  return url.replace(/\/c\/[^/?#]+/, '/c/:chain').replace(/([?&]chain=)[^&#]*/, '$1:chain')
}

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
