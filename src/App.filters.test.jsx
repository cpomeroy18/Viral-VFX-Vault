import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import App from './App'

const EFFECTS = [
  {
    id: 'a', title: 'Effect A', main_tool_used: 'Match Cut', skill_level: 'Easy',
    niche: 'Fitness', use_case: 'Visual Hook, Transitions',
    video_link: 'https://instagram.com/a', thumbnail_url: null,
    reference_tutorial: null, best_match_tutorial_url: null,
    views_count: null, likes_count: null, comments_count: null, date_posted: null,
  },
  {
    id: 'b', title: 'Effect B', main_tool_used: 'Masking', skill_level: 'Medium',
    niche: 'Beauty/Skincare', use_case: 'Storytelling',
    video_link: 'https://instagram.com/b', thumbnail_url: null,
    reference_tutorial: null, best_match_tutorial_url: null,
    views_count: null, likes_count: null, comments_count: null, date_posted: null,
  },
  {
    id: 'c', title: 'Effect C', main_tool_used: 'Match Cut', skill_level: 'Advanced',
    niche: 'Fitness', use_case: 'Storytelling',
    video_link: 'https://instagram.com/c', thumbnail_url: null,
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

// "Fitness"/"Transitions" etc. appear both as a dropdown checkbox label AND
// as plain text on matching effect cards (EffectCard renders niche/use_case
// directly) — getByRole('checkbox', {name}) scopes to the dropdown only.
function checkbox(name) {
  return screen.getByRole('checkbox', { name })
}

describe('niche / use_case multi-select filters', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('single niche selection shows only matching effects', async () => {
    localStorage.setItem('vfx_vault_email', 'lead@example.com') // bypass EmailGate
    render(<App />)
    await screen.findByText('Effect A')

    fireEvent.click(screen.getByText('NICHE'))
    fireEvent.click(checkbox('Fitness'))

    expect(screen.getByText('Effect A')).toBeInTheDocument()
    expect(screen.getByText('Effect C')).toBeInTheDocument()
    expect(screen.queryByText('Effect B')).not.toBeInTheDocument()
  })

  it('selecting two niches is OR logic — shows effects matching either', async () => {
    localStorage.setItem('vfx_vault_email', 'lead@example.com')
    render(<App />)
    await screen.findByText('Effect A')

    fireEvent.click(screen.getByText('NICHE'))
    fireEvent.click(checkbox('Fitness'))
    fireEvent.click(checkbox('Beauty/Skincare'))

    expect(screen.getByText('Effect A')).toBeInTheDocument()
    expect(screen.getByText('Effect B')).toBeInTheDocument()
    expect(screen.getByText('Effect C')).toBeInTheDocument()
  })

  it('niche + skill together is AND logic across filter types', async () => {
    localStorage.setItem('vfx_vault_email', 'lead@example.com')
    render(<App />)
    await screen.findByText('Effect A')

    fireEvent.click(screen.getByText('NICHE'))
    fireEvent.click(checkbox('Fitness'))
    fireEvent.click(screen.getByText('Easy')) // skill button; both A and C are Fitness but only A is Easy

    expect(screen.getByText('Effect A')).toBeInTheDocument()
    expect(screen.queryByText('Effect C')).not.toBeInTheDocument()
    expect(screen.queryByText('Effect B')).not.toBeInTheDocument()
  })

  it('use_case filter matches a multi-value comma field correctly', async () => {
    localStorage.setItem('vfx_vault_email', 'lead@example.com')
    render(<App />)
    await screen.findByText('Effect A')

    fireEvent.click(screen.getByText('USE CASE'))
    fireEvent.click(checkbox('Transitions')) // only on Effect A ("Visual Hook, Transitions")

    expect(screen.getByText('Effect A')).toBeInTheDocument()
    expect(screen.queryByText('Effect B')).not.toBeInTheDocument()
    expect(screen.queryByText('Effect C')).not.toBeInTheDocument()
  })

  it('typing in the dropdown search narrows the checkbox list', async () => {
    localStorage.setItem('vfx_vault_email', 'lead@example.com')
    render(<App />)
    await screen.findByText('Effect A')

    fireEvent.click(screen.getByText('NICHE'))
    expect(checkbox('Fitness')).toBeInTheDocument()
    expect(checkbox('Beauty/Skincare')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search niche…'), { target: { value: 'beau' } })

    expect(screen.queryByRole('checkbox', { name: 'Fitness' })).not.toBeInTheDocument()
    expect(checkbox('Beauty/Skincare')).toBeInTheDocument()
  })

  it('Clear resets a dropdown\'s selections', async () => {
    localStorage.setItem('vfx_vault_email', 'lead@example.com')
    render(<App />)
    await screen.findByText('Effect A')

    fireEvent.click(screen.getByText('NICHE'))
    fireEvent.click(checkbox('Fitness'))
    expect(screen.queryByText('Effect B')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Clear'))
    expect(screen.getByText('Effect B')).toBeInTheDocument()
  })
})
