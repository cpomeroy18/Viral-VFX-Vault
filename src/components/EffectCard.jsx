import { ExternalLink, Play } from 'lucide-react'
import { splitTechniques, techniqueStyle } from '../lib/techniques'

export default function EffectCard({ effect }) {
  const tags = splitTechniques(effect.main_tool_used)
  const tutorialUrl = effect.best_match_tutorial_url || effect.reference_tutorial

  return (
    <div className="group bg-[var(--panel)] border border-[var(--line)] rounded-lg overflow-hidden hover:border-[var(--ink-dim)] transition-colors flex flex-col">
      <a
        href={effect.video_link}
        target="_blank"
        rel="noopener noreferrer"
        className="relative aspect-[9/16] bg-[var(--panel-2)] flex items-center justify-center overflow-hidden"
      >
        {effect.thumbnail_url ? (
          <img
            src={effect.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="text-[var(--ink-dim)] font-mono text-xs">NO PREVIEW</div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <Play
            className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            fill="white"
          />
        </div>
        {effect.skill_level && (
          <span className="absolute top-2 left-2 font-mono text-[10px] tracking-widest bg-black/70 text-[var(--ink-dim)] px-2 py-1 rounded">
            {effect.skill_level.toUpperCase()}
          </span>
        )}
      </a>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <h3 className="font-display text-sm font-medium leading-snug">
          {effect.title}
        </h3>

        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const style = techniqueStyle(tag)
            return (
              <span
                key={tag}
                className="font-mono text-[10px] px-2 py-1 rounded border tracking-wide"
                style={{
                  color: style.hex,
                  borderColor: style.hex + '55',
                  backgroundColor: style.hex + '14',
                }}
              >
                {tag}
              </span>
            )
          })}
        </div>

        <a
          href={tutorialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto flex items-center justify-between gap-2 text-xs font-medium bg-[var(--panel-2)] hover:bg-[var(--line)] border border-[var(--line)] rounded-md px-3 py-2 transition-colors"
        >
          Watch the tutorial
          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
        </a>
      </div>
    </div>
  )
}
