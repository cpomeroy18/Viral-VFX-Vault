// Every technique gets a fixed color, like a track color in an editing timeline.
// This mapping is the visual spine of the app — used on tags, filters, and card accents.
export const TECHNIQUES = {
  'Match Cut':     { hex: '#ff4b3e', label: 'Match Cut' },
  'Masking':       { hex: '#3effa3', label: 'Masking' },
  'Remove BG':     { hex: '#3ea0ff', label: 'Remove BG' },
  'Speed Tool':    { hex: '#ffb23e', label: 'Speed Tool' },
  'Reverse':       { hex: '#c93eff', label: 'Reverse' },
  'Green Screen':  { hex: '#3eff7a', label: 'Green Screen' },
  'Splice':        { hex: '#ff3ea5', label: 'Splice' },
  'Color Change':  { hex: '#3effe0', label: 'Color Change' },
  'Keyframes':     { hex: '#ffe63e', label: 'Keyframes' },
  'Practical Effect': { hex: '#a3ff3e', label: 'Practical Effect' },
  'Template':      { hex: '#6a3eff', label: 'Template' },
  'Stop Motion':   { hex: '#ff3e7a', label: 'Stop Motion' },
}

export const DEFAULT_TECHNIQUE = { hex: '#6b6b70', label: 'Other' }

export function techniqueStyle(name) {
  return TECHNIQUES[name] || DEFAULT_TECHNIQUE
}

// Generic comma-list splitter — used for technique, use_case, and now
// filter-option derivation. Not technique-specific despite where it lives.
export function splitList(field) {
  if (!field) return []
  return field.split(',').map((t) => t.trim()).filter(Boolean)
}

export const SKILL_LEVELS = ['Easy', 'Medium', 'Advanced']
