import type { ReactNode } from 'react'
import { Navbar } from './Navbar/Navbar'

/**
 * What every page sits in: the navbar above, the page below. Rendered by main.tsx around the
 * builder, the public chain pages and the invalid-link page alike, and around the error
 * boundary, so even a crash screen has a way back to soundorp.com.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-soundorp-bg text-soundorp-text">
      <Navbar />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
