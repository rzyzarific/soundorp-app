import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render-time errors anywhere below it (e.g. an unexpected data
 * shape) so the app shows a readable message instead of a blank white
 * screen. React error boundaries must be class components.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Signal Chain Builder crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-soundorp-bg px-6">
          <div className="flex max-w-md flex-col gap-2 text-center">
            <h1 className="font-orbitron text-lg font-black text-soundorp-text">Something went wrong</h1>
            <p className="text-sm text-soundorp-muted">
              The Signal Chain Builder hit an unexpected error and couldn't render. Try reloading
              the page — if it keeps happening, your saved chains are still safe in this browser's
              storage.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mx-auto mt-2 rounded-md bg-soundorp-red px-3 py-1.5 text-sm font-medium text-white hover:bg-soundorp-red/90"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
