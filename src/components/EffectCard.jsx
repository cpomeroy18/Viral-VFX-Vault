import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Play, Eye, Heart, MessageCircle, ChevronDown } from 'lucide-react'
import { splitList, techniqueStyle } from '../lib/techniques'

function formatCount(n) {
  if (n == null) return null
  if (n < 1000) return String(n)
  const [divisor, suffix] = n < 1_000_000 ? [1_000, 'K'] : [1_000_000, 'M']
  return `${(n / divisor).toFixed(1).replace(/\.0$/, '')}${suffix}`
}

function formatPostedDate(isoString) {
  if (!isoString) return null
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return null
  return `Posted ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
}

export default function EffectCard({ effect, onRequireAuth }) {
  const tags = splitList(effect.main_tool_used)
  const useCases = splitList(effect.use_case)
  const tutorialUrl = effect.reference_tutorial
  const bestMatchUrl = effect.best_match_tutorial_url

  const [noteOpen, setNoteOpen] = useState(false)
  const noteRef = useRef(null)

  useEffect(() => {
    if (!noteOpen) return
    function handleOutside(e) {
      if (noteRef.current && !noteRef.current.contains(e.target)) {
        setNoteOpen(false)
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setNoteOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [noteOpen])

  function gatedClick(e, url) {
    if (localStorage.getItem('vfx_vault_authorized_email')) return
    e.preventDefault()
    onRequireAuth(() => window.open(url, '_blank', 'noopener,noreferrer'))
  }

  const stats = [
    { icon: Eye, value: formatCount(effect.views_count) },
    { icon: Heart, value: formatCount(effect.likes_count) },
    { icon: MessageCircle, value: formatCount(effect.comments_count) },
  ].filter((s) => s.value != null)
  const postedLabel = formatPostedDate(effect.date_posted)

  return (
    <div className="group bg-[var(--panel)] border border-[var(--line)] rounded-lg overflow-hidden hover:border-[var(--ink-dim)] transition-colors flex flex-col">
      <a
        href={effect.video_link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => gatedClick(e, effect.video_link)}
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

        {effect.niche && (
          <div className="font-mono text-[10px] tracking-widest text-[var(--ink-dim)] uppercase -mt-1">
            {effect.niche}
          </div>
        )}

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

        {useCases.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {useCases.map((useCase) => (
              <span
                key={useCase}
                className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-[var(--line)] text-[var(--ink-dim)] bg-[var(--panel-2)] tracking-wide"
              >
                {useCase}
              </span>
            ))}
          </div>
        )}

        {(stats.length > 0 || postedLabel) && (
          <div className="flex items-center gap-3 font-mono text-[10px] text-[var(--ink-dim)]">
            {stats.map(({ icon: Icon, value }, i) => (
              <span key={i} className="flex items-center gap-1">
                <Icon className="w-3 h-3" />
                {value}
              </span>
            ))}
            {postedLabel && <span className="ml-auto">{postedLabel}</span>}
          </div>
        )}

        {effect.notes && (
          <div className="relative" ref={noteRef}>
            <button
              type="button"
              onClick={() => setNoteOpen((v) => !v)}
              className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--ink-dim)] hover:text-[var(--ink)] transition-colors"
            >
              Notes
              <ChevronDown className="w-3 h-3" />
            </button>

            {noteOpen && (
              // w-full (not a fixed width) so this can never exceed the
              // card's own content width — the card has overflow-hidden
              // for the thumbnail's rounded corners, which would silently
              // clip a popover wider than the card instead of wrapping it.
              <div className="absolute bottom-full left-0 mb-2 w-full max-h-64 overflow-y-auto bg-[var(--panel)] border border-[var(--line)] rounded-md shadow-lg z-40 p-3 text-xs text-[var(--ink)] leading-relaxed whitespace-pre-wrap">
                {effect.notes}
              </div>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2">
          {tutorialUrl ? (
            <a
              href={tutorialUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => gatedClick(e, tutorialUrl)}
              className="flex items-center justify-between gap-2 text-xs font-medium bg-[var(--panel-2)] hover:bg-[var(--line)] border border-[var(--line)] rounded-md px-3 py-2 transition-colors"
            >
              Watch the tutorial
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          ) : (
            <div className="text-xs font-medium text-[var(--ink-dim)] bg-[var(--panel-2)]/50 border border-[var(--line)] rounded-md px-3 py-2 cursor-not-allowed">
              No tutorial yet
            </div>
          )}

          {bestMatchUrl && (
            <a
              href={bestMatchUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => gatedClick(e, bestMatchUrl)}
              className="flex items-center justify-between gap-2 text-xs font-medium text-[var(--ink-dim)] hover:text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--panel-2)] rounded-md px-3 py-2 transition-colors"
            >
              See it in action
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
