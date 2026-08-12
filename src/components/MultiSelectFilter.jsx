import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

export default function MultiSelectFilter({ label, options, selected, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rootRef = useRef(null)

  useEffect(() => {
    function handleOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  function toggleOpen() {
    setIsOpen((v) => !v)
    setSearch('')
  }

  function toggleValue(value) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    )
  }

  const visibleOptions = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={toggleOpen}
        className="flex items-center gap-1 font-mono text-[11px] px-2.5 py-1 rounded border tracking-wide transition-colors"
        style={{
          borderColor: isOpen || selected.length > 0 ? 'var(--scope)' : 'var(--line)',
          color: isOpen || selected.length > 0 ? 'var(--scope)' : 'var(--ink-dim)',
        }}
      >
        {label.toUpperCase()}
        {selected.length > 0 && ` (${selected.length})`}
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-64 bg-[var(--panel)] border border-[var(--line)] rounded-md shadow-lg z-40 overflow-hidden">
          <div className="p-2 border-b border-[var(--line)] flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--ink-dim)]" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded pl-6 pr-2 py-1 text-xs placeholder:text-[var(--ink-dim)] focus:border-[var(--scope)] outline-none transition-colors"
              />
            </div>
            {selected.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="font-mono text-[10px] text-[var(--ink-dim)] hover:text-[var(--ink)] underline underline-offset-2 shrink-0 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {visibleOptions.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-[var(--ink-dim)]">
                No matches
              </div>
            )}
            {visibleOptions.map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer hover:bg-[var(--panel-2)] transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => toggleValue(option)}
                  className="accent-[var(--scope)]"
                />
                <span className="text-[var(--ink)]">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
