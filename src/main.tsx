import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'
import { AppShell } from './components/AppShell.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { PublicChainPage } from './components/PublicChain/PublicChainPage.tsx'
import { scrubAnalyticsUrl } from './lib/analytics.ts'
import { readPublicChainRoute } from './lib/publicLink.ts'

// No router: the one extra route, /c/<chain>, is a read-only public page. Everything else
// is the builder. vercel.json already rewrites every path to index.html.
const publicRoute = readPublicChainRoute(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell>
      <ErrorBoundary>
        {publicRoute ? <PublicChainPage encoded={publicRoute.encoded} /> : <App />}
        <Analytics
          beforeSend={(event) => ({ ...event, url: scrubAnalyticsUrl(event.url) })}
        />
      </ErrorBoundary>
    </AppShell>
  </StrictMode>,
)
