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
    }),
  },
}))

describe('click-gated login (real App + EffectCard, simulated click)', () => {
  beforeEach(() => {
    localStorage.clear()
    window.open = vi.fn()
  })

  afterEach(() => {
    cleanup()
  })

  it('an unauthorized click does NOT call window.open directly and DOES show the login modal', async () => {
    render(<App />)
    const link = await screen.findByText('Watch the tutorial')

    fireEvent.click(link.closest('a'))

    // This is the exact symptom reported: if the setPendingAction(fn) bug is
    // present, window.open fires immediately as a side effect of the state
    // update, bypassing the gate entirely.
    expect(window.open).not.toHaveBeenCalled()

    // And the real fix should surface the LoginGate modal instead.
    expect(await screen.findByText('Verify Your Purchase')).toBeInTheDocument()
  })

  it('an already-verified visitor clicks straight through with no modal', async () => {
    localStorage.setItem('vfx_vault_authorized_email', 'buyer@example.com')
    render(<App />)
    const link = await screen.findByText('Watch the tutorial')

    fireEvent.click(link.closest('a'))

    expect(screen.queryByText('Verify Your Purchase')).not.toBeInTheDocument()
  })

  it('full flow: gated click -> submit authorized email -> opens the originally-clicked link -> modal closes', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ authorized: true }),
    })
    // Bypass the unrelated top-of-page EmailGate so only LoginGate's
    // (identically-placeholdered) email input is present.
    localStorage.setItem('vfx_vault_email', 'already-browsing@example.com')

    render(<App />)
    const link = await screen.findByText('Watch the tutorial')
    fireEvent.click(link.closest('a'))
    expect(window.open).not.toHaveBeenCalled()

    const input = await screen.findByPlaceholderText('you@email.com')
    fireEvent.change(input, { target: { value: 'buyer@example.com' } })
    fireEvent.click(screen.getByText('Continue'))

    // Wait for the modal to disappear (proves onSuccess ran and closed it).
    await vi.waitFor(() =>
      expect(screen.queryByText('Verify Your Purchase')).not.toBeInTheDocument()
    )

    expect(window.open).toHaveBeenCalledWith(
      'https://example.com/tutorial',
      '_blank',
      'noopener,noreferrer'
    )
    expect(localStorage.getItem('vfx_vault_authorized_email')).toBe('buyer@example.com')
  })
})
