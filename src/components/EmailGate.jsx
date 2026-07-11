import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function EmailGate({ onUnlock }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | error
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.includes('@')) {
      setError('Enter a valid email to continue.')
      return
    }
    setStatus('loading')
    setError('')

    const { error: dbError } = await supabase
      .from('vault_leads')
      .insert([{ email }])

    // Duplicate email is fine — treat as success, not a failure.
    if (dbError && dbError.code !== '23505') {
      setStatus('error')
      setError('Something went wrong. Try again.')
      return
    }

    localStorage.setItem('vfx_vault_email', email)
    setStatus('idle')
    onUnlock(email)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-[var(--panel)] border border-[var(--line)] rounded-lg p-8">
        <div className="font-mono text-xs text-[var(--scope)] mb-3 tracking-widest">
          ● REC — ACCESS_REQUIRED
        </div>
        <h2 className="font-display text-2xl font-semibold mb-2">
          Unlock the Vault
        </h2>
        <p className="text-[var(--ink-dim)] text-sm mb-6 leading-relaxed">
          Drop your email to browse every effect, free. Click into any
          tutorial and you'll need it again there for course access.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded-md px-4 py-3 text-sm placeholder:text-[var(--ink-dim)] focus:border-[var(--scope)] outline-none transition-colors"
          />
          {error && <p className="text-[var(--rec)] text-xs">{error}</p>}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-[var(--rec)] hover:opacity-90 disabled:opacity-50 text-white font-medium rounded-md px-4 py-3 text-sm transition-opacity"
          >
            {status === 'loading' ? 'Unlocking…' : 'Unlock Vault'}
          </button>
        </form>
      </div>
    </div>
  )
}
