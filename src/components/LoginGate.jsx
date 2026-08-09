import { useState } from 'react'

const SALES_PAGE_URL = 'https://offer.colinpomeroy.com/offer/'

export default function LoginGate({ onClose, onSuccess }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | denied | error
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.includes('@')) {
      setError('Enter a valid email to continue.')
      return
    }
    setStatus('loading')
    setError('')

    try {
      const res = await fetch('/api/check-authorized', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Request failed')

      if (data.authorized) {
        localStorage.setItem('vfx_vault_authorized_email', email)
        onSuccess()
      } else {
        setStatus('denied')
      }
    } catch {
      setStatus('error')
      setError('Something went wrong. Try again.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--panel)] border border-[var(--line)] rounded-lg p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-mono text-xs text-[var(--scope)] mb-3 tracking-widest">
          ● REC — PURCHASE_REQUIRED
        </div>

        {status === 'denied' ? (
          <>
            <h2 className="font-display text-2xl font-semibold mb-2">
              Email not found
            </h2>
            <p className="text-[var(--ink-dim)] text-sm mb-6 leading-relaxed">
              We don't see a purchase under this email — check the email
              you used at checkout, or grab the course here.
            </p>
            <div className="space-y-3">
              <a
                href={SALES_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center w-full bg-[var(--rec)] hover:opacity-90 text-white font-medium rounded-md px-4 py-3 text-sm transition-opacity"
              >
                Get the course
              </a>
              <button
                type="button"
                onClick={() => {
                  setStatus('idle')
                  setError('')
                }}
                className="w-full bg-[var(--panel-2)] hover:bg-[var(--line)] border border-[var(--line)] rounded-md px-4 py-3 text-sm transition-colors"
              >
                Try a different email
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl font-semibold mb-2">
              Verify Your Purchase
            </h2>
            <p className="text-[var(--ink-dim)] text-sm mb-6 leading-relaxed">
              Enter the email you used at checkout to unlock tutorials and
              source videos.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                autoFocus
                className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded-md px-4 py-3 text-sm placeholder:text-[var(--ink-dim)] focus:border-[var(--scope)] outline-none transition-colors"
              />
              {error && <p className="text-[var(--rec)] text-xs">{error}</p>}
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-[var(--rec)] hover:opacity-90 disabled:opacity-50 text-white font-medium rounded-md px-4 py-3 text-sm transition-opacity"
              >
                {status === 'loading' ? 'Checking…' : 'Continue'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
