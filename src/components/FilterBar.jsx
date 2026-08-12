import { Search } from 'lucide-react'
import { TECHNIQUES, SKILL_LEVELS } from '../lib/techniques'
import MultiSelectFilter from './MultiSelectFilter'

export default function FilterBar({
  search,
  onSearch,
  activeTechnique,
  onTechnique,
  activeSkill,
  onSkill,
  nicheOptions,
  activeNiches,
  onNiches,
  useCaseOptions,
  activeUseCases,
  onUseCases,
  count,
}) {
  return (
    <div className="sticky top-0 z-30 bg-[var(--bg)]/95 backdrop-blur-sm border-b border-[var(--line)]">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-dim)]" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search effects…"
            className="w-full bg-[var(--panel)] border border-[var(--line)] rounded-md pl-9 pr-4 py-2.5 text-sm placeholder:text-[var(--ink-dim)] focus:border-[var(--scope)] outline-none transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onTechnique(null)}
            className="font-mono text-[11px] px-2.5 py-1 rounded border tracking-wide transition-colors"
            style={{
              borderColor: activeTechnique === null ? 'var(--scope)' : 'var(--line)',
              color: activeTechnique === null ? 'var(--scope)' : 'var(--ink-dim)',
            }}
          >
            ALL
          </button>
          {Object.entries(TECHNIQUES).map(([name, style]) => (
            <button
              key={name}
              onClick={() => onTechnique(activeTechnique === name ? null : name)}
              className="font-mono text-[11px] px-2.5 py-1 rounded border tracking-wide transition-colors"
              style={{
                color: style.hex,
                borderColor: activeTechnique === name ? style.hex : style.hex + '40',
                backgroundColor: activeTechnique === name ? style.hex + '1A' : 'transparent',
              }}
            >
              {name}
            </button>
          ))}

          <span className="w-px h-4 bg-[var(--line)] mx-1" />

          {SKILL_LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => onSkill(activeSkill === level ? null : level)}
              className="font-mono text-[11px] px-2.5 py-1 rounded border tracking-wide transition-colors"
              style={{
                borderColor: activeSkill === level ? 'var(--ink)' : 'var(--line)',
                color: activeSkill === level ? 'var(--ink)' : 'var(--ink-dim)',
              }}
            >
              {level}
            </button>
          ))}

          <span className="w-px h-4 bg-[var(--line)] mx-1" />

          <MultiSelectFilter
            label="Niche"
            options={nicheOptions}
            selected={activeNiches}
            onChange={onNiches}
          />
          <MultiSelectFilter
            label="Use Case"
            options={useCaseOptions}
            selected={activeUseCases}
            onChange={onUseCases}
          />

          <span className="ml-auto font-mono text-[11px] text-[var(--ink-dim)]">
            {count} EFFECT{count === 1 ? '' : 'S'}
          </span>
        </div>
      </div>
    </div>
  )
}
