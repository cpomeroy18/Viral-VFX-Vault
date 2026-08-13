import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import App from './App'

const EFFECTS = [
  {
    id: 'a', title: 'Effect With Note', main_tool_used: 'Match Cut', skill_level: 'Easy',
    niche: null, use_case: null, notes: 'Tip: do the swipe on beat 2, not beat 1.',
    video_link: 'https://instagram.com/a', thumbnail_url: null,
    reference_tutorial: null, best_match_tutorial_url: null,
    views_count: null, likes_count: null, comments_count: null, date_posted: null,
  },
  {
    id: 'b', title: 'Effect Without Note', main_tool_used: 'Masking', skill_level: 'Medium',
    niche: null, use_case: null, notes: null,
    video_link: 'https://instagram.com/b', thumbnail_url: null,
    reference_tutorial: null, best_match_tutorial_url: null,
    views_count: null, likes_count: null, comments_count: null, date_posted: null,
  },
]

vi.mock('./lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: EFFECTS, error: null }),
      }),
    }),
  },
}))

describe('notes popover', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('only shows the Notes trigger on the effect that has a note', async () => {
    localStorage.setItem('vfx_vault_email', 'lead@example.com') // bypass EmailGate
    render(<App />)
    await screen.findByText('Effect With Note')

    expect(screen.getAllByText('Notes')).toHaveLength(1)
    expect(screen.queryByText('Tip: do the swipe on beat 2, not beat 1.')).not.toBeInTheDocument()
  })

  it('clicking Notes reveals the full text, clicking again hides it', async () => {
    localStorage.setItem('vfx_vault_email', 'lead@example.com')
    render(<App />)
    await screen.findByText('Effect With Note')

    fireEvent.click(screen.getByText('Notes'))
    expect(screen.getByText('Tip: do the swipe on beat 2, not beat 1.')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Notes'))
    expect(screen.queryByText('Tip: do the swipe on beat 2, not beat 1.')).not.toBeInTheDocument()
  })

  it('clicking outside the popover closes it', async () => {
    localStorage.setItem('vfx_vault_email', 'lead@example.com')
    render(<App />)
    await screen.findByText('Effect With Note')

    fireEvent.click(screen.getByText('Notes'))
    expect(screen.getByText('Tip: do the swipe on beat 2, not beat 1.')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Tip: do the swipe on beat 2, not beat 1.')).not.toBeInTheDocument()
  })
})
