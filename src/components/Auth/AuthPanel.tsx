import { useEffect, useState, type FormEvent } from 'react'
import { useAuthStore } from '../../store/useAuthStore'

export function AuthPanel() {
  const session = useAuthStore((s) => s.session)
  const status = useAuthStore((s) => s.status)
  const error = useAuthStore((s) => s.error)
  const magicLinkSentTo = useAuthStore((s) => s.magicLinkSentTo)
  const init = useAuthStore((s) => s.init)
  const signInWithMagicLink = useAuthStore((s) => s.signInWithMagicLink)
  const signOut = useAuthStore((s) => s.signOut)
  const clearError = useAuthStore((s) => s.clearError)
  const clearMagicLinkSent = useAuthStore((s) => s.clearMagicLinkSent)

  const [email, setEmail] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    init()
  }, [init])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    await signInWithMagicLink(email.trim())
  }

  if (session) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-soundorp-text">{session.user.email}</span>
        <button
          type="button"
          onClick={signOut}
          className="rounded-md border border-soundorp-border px-2 py-1 text-xs font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text"
        >
          Sign out
        </button>
      </div>
    )
  }

  if (magicLinkSentTo) {
    return (
      <div className="flex items-center gap-2 text-xs text-status-pass-text">
        <span>Check {magicLinkSentTo} for a sign-in link.</span>
        <button
          type="button"
          onClick={clearMagicLinkSent}
          className="text-soundorp-muted hover:text-soundorp-text"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    )
  }

  if (status === 'unconfigured') {
    return (
      <button
        type="button"
        disabled
        title="Sign-in isn't available yet"
        className="cursor-not-allowed rounded-md border border-soundorp-border px-3 py-1.5 text-sm font-medium text-soundorp-muted opacity-50"
      >
        Sign in
      </button>
    )
  }

  if (!formOpen) {
    return (
      <button
        type="button"
        onClick={() => setFormOpen(true)}
        disabled={status === 'loading'}
        className="rounded-md border border-soundorp-border px-3 py-1.5 text-sm font-medium text-soundorp-muted hover:bg-[#1f1f1f] hover:text-soundorp-text disabled:opacity-50"
      >
        Sign in
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-1.5">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-44 rounded-md border border-soundorp-border bg-soundorp-bg px-2 py-1 text-xs text-soundorp-text outline-none focus:border-soundorp-red"
      />
      <button
        type="submit"
        className="rounded-md bg-soundorp-red px-2 py-1 text-xs font-medium text-white hover:bg-soundorp-red/90"
      >
        Send link
      </button>
      <button
        type="button"
        onClick={() => setFormOpen(false)}
        className="text-xs text-soundorp-muted hover:text-soundorp-text"
      >
        Cancel
      </button>
      {error && (
        <span className="flex items-center gap-1 text-xs text-status-critical-text">
          {error}
          <button type="button" onClick={clearError} aria-label="Dismiss error">
            ×
          </button>
        </span>
      )}
    </form>
  )
}
