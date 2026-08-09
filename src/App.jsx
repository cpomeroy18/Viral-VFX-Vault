import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { splitTechniques } from './lib/techniques'
import EmailGate from './components/EmailGate'
import LoginGate from './components/LoginGate'
import FilterBar from './components/FilterBar'
import EffectCard from './components/EffectCard'

export default function App() {
  const [unlocked, setUnlocked] = useState(false)
  const [effects, setEffects] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)

  const [search, setSearch] = useState('')
  const [activeTechnique, setActiveTechnique] = useState(null)
  const [activeSkill, setActiveSkill] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('vfx_vault_email')
    if (saved) setUnlocked(true)
  }, [])

  useEffect(() => {
    async function loadEffects() {
      const { data, error } = await supabase
        .from('effects')
        .select('*')
        .order('date_added', { ascending: false })

      if (error) {
        setLoadError(error.message)
      } else {
        setEffects(data)
      }
      setLoading(false)
    }
    loadEffects()
  }, [])

  const filtered = useMemo(() => {
    return effects.filter((e) => {
      if (search && !e.title?.toLowerCase().includes(search.toLowerCase())) {
        return false
      }
      if (activeTechnique) {
        const tags = splitTechniques(e.main_tool_used)
        if (!tags.includes(activeTechnique)) return false
      }
      if (activeSkill && e.skill_level !== activeSkill) {
        return false
      }
      return true
    })
  }, [effects, search, activeTechnique, activeSkill])

  return (
    <div className="min-h-screen">
      {!unlocked && <EmailGate onUnlock={() => setUnlocked(true)} />}

      {pendingAction && (
        <LoginGate
          onClose={() => setPendingAction(null)}
          onSuccess={() => {
            pendingAction()
            setPendingAction(null)
          }}
        />
      )}

      <header className="scanlines border-b border-[var(--line)] px-4 py-10 text-center">
        <div className="font-mono text-xs text-[var(--rec)] tracking-widest mb-3">
          ● REC — VFX VAULT
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold">
          The Viral VFX Vault
        </h1>
        <p className="text-[var(--ink-dim)] text-sm mt-2 max-w-md mx-auto">
          Every effect, tagged by technique. Click through to learn exactly
          how it's done.
        </p>
      </header>

      <FilterBar
        search={search}
        onSearch={setSearch}
        activeTechnique={activeTechnique}
        onTechnique={setActiveTechnique}
        activeSkill={activeSkill}
        onSkill={setActiveSkill}
        count={filtered.length}
      />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {loading && (
          <p className="text-center text-[var(--ink-dim)] font-mono text-sm py-20">
            Loading vault…
          </p>
        )}

        {loadError && (
          <p className="text-center text-[var(--rec)] font-mono text-sm py-20">
            Couldn't load the vault: {loadError}
          </p>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <p className="text-center text-[var(--ink-dim)] font-mono text-sm py-20">
            No effects match those filters.
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((effect) => (
            <EffectCard key={effect.id} effect={effect} onRequireAuth={setPendingAction} />
          ))}
        </div>
      </main>
    </div>
  )
}
