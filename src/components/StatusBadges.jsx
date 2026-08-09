function Badge({ label, onLogout }) {
  return (
    <div className="flex items-center gap-2 bg-[var(--panel)]/90 backdrop-blur-sm border border-[var(--line)] rounded-full pl-2.5 pr-3 py-1.5 font-mono text-[11px]">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--scope)' }} />
      <span className="text-[var(--ink-dim)] tracking-wide">{label}</span>
      <button
        type="button"
        onClick={onLogout}
        className="text-[var(--ink-dim)] hover:text-[var(--ink)] underline underline-offset-2 transition-colors"
      >
        Log out
      </button>
    </div>
  )
}

export default function StatusBadges({ browsingUnlocked, authorizedEmail, onLogoutBrowsing, onLogoutAuthorized }) {
  if (!browsingUnlocked && !authorizedEmail) return null

  return (
    <div className="fixed top-3 right-3 z-40 flex flex-col items-end gap-1.5">
      {browsingUnlocked && <Badge label="Browsing free" onLogout={onLogoutBrowsing} />}
      {authorizedEmail && <Badge label="Unlocked" onLogout={onLogoutAuthorized} />}
    </div>
  )
}
