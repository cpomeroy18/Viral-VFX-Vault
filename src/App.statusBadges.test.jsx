import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import App from './App'

const FAKE_EFFECT = {
  id: '1',
  title: 'Test Effect',
  main_tool_used: 'Match Cut',
  skill_level: 'Easy',
  reference_tutorial: 'https://example.com/tutorial',
  best_match_tutorial_url: null,
  video_link: 'https://instagram.com/reel/xyz',
  thumbnail_url: null,
  use_case: null,
  niche: null,
  views_count: null,
  likes_count: null,
  comments_count: null,
  date_posted: null,
}

vi.mock('./lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [FAKE_EFFECT], error: null }),
      }),
      // EmailGate's submit path (vault_leads insert) — not exercised by the
      // gating test suite since it always bypasses EmailGate via localStorage.
      insert: () => Promise.resolve({ error: null }),
    }),
  },
}))

describe('status badges (real App, real localStorage)', () => {
  beforeEach(() => {
    localStorage.clear()
    window.open = vi.fn()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows neither badge for a brand-new visitor', async () => {
    render(<App />)
    await screen.findByText('Unlock the Vault') // wait for initial render to settle
    expect(screen.queryByText('Browsing free')).not.toBeInTheDocument()
    expect(screen.queryByText('Unlocked')).not.toBeInTheDocument()
  })

  it('shows "Browsing free" once the EmailGate is passed, and logging out removes it and re-opens EmailGate', async () => {
    render(<App />)

    const input = await screen.findByPlaceholderText('you@email.com')
    fireEvent.change(input, { target: { value: 'lead@example.com' } })
    fireEvent.click(screen.getByText('Unlock Vault'))

    expect(await screen.findByText('Browsing free')).toBeInTheDocument()
    expect(screen.queryByText('Unlocked')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Log out'))

    expect(screen.queryByText('Browsing free')).not.toBeInTheDocument()
    expect(localStorage.getItem('vfx_vault_email')).toBeNull()
    // Logging out should re-show the free-browse gate.
    expect(await screen.findByText('Unlock the Vault')).toBeInTheDocument()
  })

  it('shows "Unlocked" once a purchase is verified, and logging out removes just that badge', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ authorized: true }),
    })
    localStorage.setItem('vfx_vault_email', 'already-browsing@example.com')

    render(<App />)
    const link = await screen.findByText('Watch the tutorial')
    fireEvent.click(link.closest('a'))

    const input = await screen.findByPlaceholderText('you@email.com')
    fireEvent.change(input, { target: { value: 'buyer@example.com' } })
    fireEvent.click(screen.getByText('Continue'))

    expect(await screen.findByText('Unlocked')).toBeInTheDocument()
    expect(screen.getByText('Browsing free')).toBeInTheDocument()

    fireEvent.click(screen.getAllByText('Log out')[1]) // the "Unlocked" badge's own logout

    expect(screen.queryByText('Unlocked')).not.toBeInTheDocument()
    expect(localStorage.getItem('vfx_vault_authorized_email')).toBeNull()
    // The free-browse badge should be unaffected.
    expect(screen.getByText('Browsing free')).toBeInTheDocument()
  })

  it('shows both badges at once for a returning, fully-verified visitor', async () => {
    localStorage.setItem('vfx_vault_email', 'lead@example.com')
    localStorage.setItem('vfx_vault_authorized_email', 'buyer@example.com')

    render(<App />)

    expect(await screen.findByText('Browsing free')).toBeInTheDocument()
    expect(screen.getByText('Unlocked')).toBeInTheDocument()
  })
})
