// scripts/add-effect.js
//
// The core "add new effect" pipeline:
//   1. You paste rows: link, technique(s), skill, best_match_tutorial_url,
//      niche, use_case(s) (everything but the link is optional) — comma- or
//      tab-separated (tab-separated works with a direct paste from a
//      spreadsheet)
//   2. Each link gets scraped via Apify (caption, thumbnail)
//   3. If technique/skill/niche/use_case were given on the row, they're used
//      as-is. Any left blank get filled in by Claude reading the caption
//      against technique-rulebook.md — no confirmation prompt, it just runs.
//   4. Thumbnail gets rehosted permanently, row gets written to Supabase
//
// This auto-publishes every row that scrapes successfully. Anything Claude
// filled in (rather than you) is flagged as AI-guessed in the output so you
// know what to spot-check afterward.
//
// Setup (one-time):
//   npm install @supabase/supabase-js apify-client
//   Add to scripts/.env.backfill:
//     ANTHROPIC_API_KEY=...
//     TIKTOK_ACTOR_ID=...   (see note below)
//
// Run:
//   node scripts/add-effect.js
//   Paste rows, one per line, e.g.:
//     https://www.instagram.com/reel/XXXX/,Match Cut,Easy
//     https://www.instagram.com/reel/YYYY/
//     https://www.instagram.com/reel/ZZZZ/,Masking;Remove BG,Medium
//     https://www.instagram.com/reel/WWWW/,Match Cut,Easy,https://youtu.be/some-specific-tutorial
//     https://www.instagram.com/reel/VVVV/,Match Cut,Easy,,Fitness,Hook/Attention-Grabber;Outfit/Clothing Reveal
//   (multiple values within the technique or use_case fields are separated
//   by ";" regardless of whether the row itself uses commas or tabs; niche
//   is single-value, like skill. Leave a field blank between two commas to
//   skip it while still supplying a later column, as in the last example
//   above which skips best_match_tutorial_url.)
//   Re-pasting a link that's already saved updates that row instead of
//   duplicating it — handy for adding just a best_match_tutorial_url later.
//   Note: technique/skill/niche/use_case work differently — leaving those
//   blank still triggers a fresh AI guess that overwrites the existing
//   value (see below), so repeat the existing value on the row if you only
//   want to add a tutorial URL.
//   Blank line to finish and start processing.

import { createClient } from '@supabase/supabase-js'
import { ApifyClient } from 'apify-client'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import readline from 'readline/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv(path) {
  const text = readFileSync(path, 'utf-8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
  }
  return env
}

const env = loadEnv(join(__dirname, '.env.backfill'))
const rulebook = readFileSync(join(__dirname, 'technique-rulebook.md'), 'utf-8')

// Technique -> generic fallback tutorial URL. Fill these in once —
// they're used to auto-populate reference_tutorial on every new effect.
const tutorialMap = JSON.parse(
  readFileSync(join(__dirname, 'technique-tutorials.json'), 'utf-8')
)

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const apify = new ApifyClient({ token: env.APIFY_TOKEN })

const INSTAGRAM_ACTOR_ID = 'apify/instagram-reel-scraper'
// Confirmed working against a real TikTok link — see the `postURLs` input
// field and the field-name comments in scrape() below.
const TIKTOK_ACTOR_ID = env.TIKTOK_ACTOR_ID || 'clockworks/tiktok-scraper'

const BUCKET = 'thumbnails'
const TECHNIQUES = [
  'Match Cut', 'Masking', 'Remove BG', 'Speed Tool',
  'Reverse', 'Green Screen', 'Splice', 'Color Change', 'Keyframes',
  'Practical Effect', 'Template', 'Stop Motion',
]

// Template can only be identified by watching for an on-screen badge —
// scraped caption/metadata never contains it, so per technique-rulebook.md
// it must always be supplied manually and should never be offered as an AI
// guess.
const AI_GUESSABLE_TECHNIQUES = TECHNIQUES.filter((t) => t !== 'Template')

const NICHES = [
  'Fitness', 'Beauty/Skincare', 'Fashion', 'Food/Cooking', 'Real Estate',
  'Restaurant/Bar', 'Tattoo Shop', 'Barber/Salon', 'Travel', 'Comedy',
  'Personal Finance', 'Home/DIY', 'Automotive', 'Pets', 'Parenting/Family',
  'Tech/App', 'Music', 'Sports', 'Video/Editing', 'Storytelling/Personality',
  'Vlog/Personal', 'Local Business', 'Product Showcase', 'Other',
]

const USE_CASES = [
  'Visual Hook', 'Outfit/Clothing Reveal', 'Product Showcase',
  'Before/After Reveal', 'Comedic Punchline', 'Storytelling', 'Transitions',
  'Magic/Illusion', 'Travel', 'Creative Edits',
]

// Matches a manually-typed value to its canonical casing (e.g. "masking" ->
// "Masking") so a spreadsheet typo doesn't silently break a lookup or
// fragment the tag in the DB.
function makeCanonicalizer(list) {
  const lower = new Map(list.map((v) => [v.toLowerCase(), v]))
  return (name) => lower.get(name.toLowerCase()) || name
}
const canonicalizeTechnique = makeCanonicalizer(TECHNIQUES)
const canonicalizeNiche = makeCanonicalizer(NICHES)
const canonicalizeUseCase = makeCanonicalizer(USE_CASES)

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[a.length][b.length]
}

function normalizeForMatch(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Validates a manually-typed niche/use_case value against its fixed list.
// Unlike technique's canonicalizer (which silently passes through anything
// with no match), this never lets an off-list value through unnoticed:
//   - exact match (case-insensitive)              -> use as-is, silent
//   - normalized match (spacing/punctuation only)  -> auto-correct + note
//     e.g. "Realestate" -> "Real Estate"
//   - one clear closest fuzzy match (typo)         -> auto-correct + note
//   - "new:X" prefix                               -> explicit opt-in to
//     save X as a genuinely new, off-list category
//   - anything else (ambiguous / not close)        -> flagged for manual
//     review, not saved
function resolveAgainstList(rawInput, list) {
  const trimmed = rawInput.trim()

  const newMatch = /^new:(.*)$/i.exec(trimmed)
  if (newMatch) {
    return { value: newMatch[1].trim(), corrected: null, needsReview: false }
  }

  const exact = list.find((n) => n.toLowerCase() === trimmed.toLowerCase())
  if (exact) return { value: exact, corrected: null, needsReview: false }

  const normInput = normalizeForMatch(trimmed)
  const normMatch = list.find((n) => normalizeForMatch(n) === normInput)
  if (normMatch) {
    return { value: normMatch, corrected: { from: trimmed, to: normMatch }, needsReview: false }
  }

  const distances = list
    .map((n) => ({ n, d: levenshtein(normInput, normalizeForMatch(n)) }))
    .sort((a, b) => a.d - b.d)
  const [best, secondBest] = distances
  const maxDistance = Math.max(2, Math.floor(trimmed.length * 0.3))
  if (best.d <= maxDistance && (!secondBest || secondBest.d > best.d)) {
    return { value: best.n, corrected: { from: trimmed, to: best.n }, needsReview: false }
  }

  return { value: null, corrected: null, needsReview: true, typedValue: trimmed }
}

// Validates a manually-typed niche/use_case against its fixed list. Unlike
// technique's canonicalizer (which silently passes through anything with no
// match), this never lets an off-list value through unnoticed — see
// resolveAgainstList for the exact/normalized/fuzzy/"new:"/flag tiers.
const resolveNiche = (rawInput) => resolveAgainstList(rawInput, NICHES)
const resolveUseCase = (rawInput) => resolveAgainstList(rawInput, USE_CASES)

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function isTikTok(url) {
  return url.includes('tiktok.com')
}

async function scrape(url) {
  const actorId = isTikTok(url) ? TIKTOK_ACTOR_ID : INSTAGRAM_ACTOR_ID
  // clockworks/tiktok-scraper takes direct post links on `postURLs`, not
  // `username` (apify/instagram-reel-scraper's field) — confirmed via a
  // real failing call: "Input must contain postURLs, hashtags, search
  // queries, music references or profiles."
  const input = isTikTok(url)
    ? { postURLs: [url], resultsPerPage: 1 }
    : { username: [url], resultsLimit: 1 }
  const run = await apify.actor(actorId).call(input)
  const { items } = await apify.dataset(run.defaultDatasetId).listItems()
  const item = items[0]
  if (!item) return null
  return {
    title: item.caption?.slice(0, 120) || item.text?.slice(0, 120) || '(no caption)',
    caption: item.caption || item.text || '',
    // videoMeta.coverUrl is clockworks/tiktok-scraper's thumbnail field,
    // confirmed via a real TikTok scrape.
    thumbnailUrl: item.displayUrl || item.thumbnailUrl || item.videoMeta?.coverUrl || null,
    // apify/instagram-reel-scraper returns videoPlayCount (the public "plays"
    // number shown on the reel) AND a separate, smaller videoViewCount — we
    // use videoPlayCount as views_count since it's the one Instagram surfaces
    // publicly. clockworks/tiktok-scraper uses playCount/diggCount/
    // commentCount instead — all confirmed via a real TikTok scrape.
    viewsCount: item.videoPlayCount ?? item.playCount ?? item.videoViewCount ?? null,
    likesCount: item.likesCount ?? item.diggCount ?? null,
    commentsCount: item.commentsCount ?? item.commentCount ?? null,
    // item.timestamp (ISO string) is apify/instagram-reel-scraper's field;
    // createTimeISO is clockworks/tiktok-scraper's equivalent — both
    // confirmed via real scrapes.
    postedAt: item.timestamp ?? item.createTimeISO ?? item.createTime ?? null,
  }
}

async function suggestTags(caption) {
  const prompt = `You are matching a short-form video against a fixed list of VFX techniques using the rulebook below. Return ONLY valid JSON, no other text.

${rulebook}

Video caption/description:
"""
${caption || '(no caption available)'}
"""

Return this exact JSON shape:
{
  "techniques": [{"name": "<one of: ${AI_GUESSABLE_TECHNIQUES.join(', ')}>", "confidence": <0-100>}],
  "skill_level": "<Easy|Medium|Advanced>",
  "niche": {"name": "<one of: ${NICHES.join(', ')}>", "confidence": <0-100>},
  "use_cases": [{"name": "<one of: ${USE_CASES.join(', ')}>", "confidence": <0-100>}],
  "reasoning": "<one sentence>"
}

"niche" is the type of creator/business the video is for — pick exactly one, "Other" if nothing fits. "use_cases" is what the effect is doing for the video (can be more than one) — use "Creative Edits" as a catch-all if nothing else on the list fits, same idea as "Other" for niche. Only include techniques/use_cases you have real signal for from the caption. If the caption gives little to go on, say so honestly with low confidence rather than guessing. Never suggest "Template" — it can only be identified by watching the video for an on-screen badge, never from caption/metadata, so it's excluded from the list above entirely.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  const text = data.content?.[0]?.text || '{}'
  const cleaned = text.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return {
      techniques: [], skill_level: 'Medium', niche: null, use_cases: [],
      reasoning: 'Could not parse AI response — please tag manually.',
    }
  }
}

async function downloadImage(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function uploadThumbnail(effectId, imageBuffer) {
  const path = `${effectId}.jpg`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, imageBuffer, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// Row format: link, technique(s), skill, best_match_tutorial_url, niche,
// use_case(s) — all but the link are optional. Separator is a tab if the
// row has one (spreadsheet paste), else a comma. Multiple values within the
// technique or use_case fields are always ";"-separated, regardless of the
// row separator, so they don't collide with a comma-separated row. niche is
// single-value, like skill.
function parseRow(raw) {
  const sep = raw.includes('\t') ? '\t' : ','
  const [urlRaw, techniqueRaw, skillRaw, bestMatchTutorialRaw, nicheRaw, useCaseRaw] = raw.split(sep)
  const url = (urlRaw || '').trim()
  const techniques = (techniqueRaw || '')
    .split(';')
    .map((t) => t.trim())
    .filter(Boolean)
  const skill = (skillRaw || '').trim()
  const bestMatchTutorialUrl = (bestMatchTutorialRaw || '').trim()
  const niche = (nicheRaw || '').trim()
  const useCases = (useCaseRaw || '')
    .split(';')
    .map((u) => u.trim())
    .filter(Boolean)
  return { url, techniques, skill, bestMatchTutorialUrl, niche, useCases }
}

async function processRow(raw) {
  const {
    url, techniques: givenTechniques, skill: givenSkill, bestMatchTutorialUrl,
    niche: givenNiche, useCases: givenUseCases,
  } = parseRow(raw)
  if (!url) {
    console.log(`  Skipping unparseable row: "${raw}"`)
    return null
  }

  console.log(`\n--- ${url} ---`)
  console.log('Scraping...')
  const scraped = await scrape(url)
  if (!scraped) {
    console.log('  Could not scrape this link. Skipping.')
    return null
  }

  let finalTechniques = givenTechniques
  let finalSkill = givenSkill
  let finalNiche = givenNiche
  let finalUseCases = givenUseCases
  let techniqueGuessed = false
  let skillGuessed = false
  let nicheGuessed = false
  let useCaseGuessed = false
  let nicheNeedsReview = false
  let nicheTypedValue = null
  let useCaseNeedsReview = []

  // Manually-typed niche gets validated against the fixed list right away —
  // AI-guessed niche doesn't need this since the prompt already constrains
  // it to an exact list value.
  if (givenNiche) {
    const resolution = resolveNiche(givenNiche)
    finalNiche = resolution.value || ''
    if (resolution.corrected) {
      console.log(`  Niche corrected: "${resolution.corrected.from}" → "${resolution.corrected.to}"`)
    }
    if (resolution.needsReview) {
      nicheNeedsReview = true
      nicheTypedValue = resolution.typedValue
      console.log(`  Niche "${resolution.typedValue}" isn't on the list and wasn't a confident match — flagged for review, left blank. Prefix with "new:" to save it as a new category.`)
    }
  }

  // Same validation per manually-typed use_case entry (each ";"-separated
  // token is resolved independently) — a row can still save its other
  // valid use_case(s) even if one entry gets flagged.
  if (givenUseCases.length > 0) {
    const resolvedUseCases = []
    for (const typed of givenUseCases) {
      const resolution = resolveUseCase(typed)
      if (resolution.corrected) {
        console.log(`  Use case corrected: "${resolution.corrected.from}" → "${resolution.corrected.to}"`)
      }
      if (resolution.needsReview) {
        useCaseNeedsReview.push(resolution.typedValue)
        console.log(`  Use case "${resolution.typedValue}" isn't on the list and wasn't a confident match — flagged for review, not saved. Prefix with "new:" to save it as a new category.`)
      } else if (resolution.value) {
        resolvedUseCases.push(resolution.value)
      }
    }
    finalUseCases = resolvedUseCases
  }

  const hasCaption = !!(scraped.caption && scraped.caption.trim())
  const hasThumbnail = !!scraped.thumbnailUrl
  const hasStats = scraped.viewsCount != null || scraped.likesCount != null || scraped.commentsCount != null
  const insufficientData = !hasCaption && !hasThumbnail && !hasStats
  if (insufficientData) {
    console.log('  Insufficient data to auto-tag — needs manual review.')
  }

  const needsGuessing = givenTechniques.length === 0 || !givenSkill || !givenNiche || givenUseCases.length === 0

  // Without a caption there's nothing for Claude to actually read, so
  // guessing would just be fabricating a low-signal tag rather than a real
  // read — leave whatever's still blank as blank instead.
  if (needsGuessing && hasCaption) {
    console.log('Asking Claude to suggest tags...')
    const suggestion = await suggestTags(scraped.caption)

    if (givenTechniques.length === 0) {
      const top = [...suggestion.techniques].sort((a, b) => b.confidence - a.confidence)[0]
      finalTechniques = top ? [top.name] : []
      techniqueGuessed = true
    }
    if (!givenSkill) {
      finalSkill = suggestion.skill_level || 'Medium'
      skillGuessed = true
    }
    if (!givenNiche) {
      finalNiche = suggestion.niche?.name || ''
      nicheGuessed = true
    }
    if (givenUseCases.length === 0) {
      const top = [...(suggestion.use_cases || [])].sort((a, b) => b.confidence - a.confidence)[0]
      finalUseCases = top ? [top.name] : []
      useCaseGuessed = true
    }
  } else if (needsGuessing && !insufficientData) {
    console.log('  No caption available — leaving blank technique/skill/niche/use_case unset rather than guessing.')
  }

  const aiGuessed = techniqueGuessed || skillGuessed || nicheGuessed || useCaseGuessed
  finalTechniques = finalTechniques.map(canonicalizeTechnique)
  finalNiche = finalNiche ? canonicalizeNiche(finalNiche) : finalNiche
  finalUseCases = finalUseCases.map(canonicalizeUseCase)

  // Auto-fill the generic tutorial link from the first technique. Trimmed
  // in case technique-tutorials.json ever picks up stray whitespace — a
  // leading space turns an absolute URL into a broken relative link.
  const referenceTutorial = finalTechniques.length > 0 ? (tutorialMap[finalTechniques[0]] || '').trim() || null : null
  if (finalTechniques.length > 0 && !referenceTutorial) {
    console.log(`  Note: no tutorial URL mapped for "${finalTechniques[0]}" yet — reference_tutorial will be blank. Fill it in later via Supabase, or add it to scripts/technique-tutorials.json.`)
  }

  // Update in place if this video_link already has a row, instead of
  // creating a duplicate.
  const { data: existing } = await supabase
    .from('effects')
    .select('id')
    .eq('video_link', url)
    .maybeSingle()
  const isUpdate = !!existing

  const row = {
    title: scraped.title,
    main_tool_used: finalTechniques.join(', '),
    skill_level: finalSkill || null,
    reference_tutorial: referenceTutorial,
    views_count: scraped.viewsCount,
    likes_count: scraped.likesCount,
    comments_count: scraped.commentsCount,
    date_posted: scraped.postedAt,
    niche: finalNiche || null,
    use_case: finalUseCases.join(', ') || null,
    // Only set when given — blank/missing means "leave untouched", not
    // "clear it out", especially on update. Trimmed defensively (parseRow
    // already trims it, but a leading/trailing space here would break the
    // link the same way as in reference_tutorial above).
    ...(bestMatchTutorialUrl ? { best_match_tutorial_url: bestMatchTutorialUrl.trim() } : {}),
  }

  const { data: saved, error: saveError } = isUpdate
    ? await supabase.from('effects').update(row).eq('id', existing.id).select().single()
    : await supabase.from('effects').insert([{ ...row, video_link: url }]).select().single()

  if (saveError) {
    console.log(`  Failed to ${isUpdate ? 'update' : 'save'}: ${saveError.message}`)
    return null
  }

  if (scraped.thumbnailUrl) {
    try {
      const imageBuffer = await downloadImage(scraped.thumbnailUrl)
      const permanentUrl = await uploadThumbnail(saved.id, imageBuffer)
      await supabase.from('effects').update({ thumbnail_url: permanentUrl }).eq('id', saved.id)
    } catch (err) {
      console.log(`  Thumbnail failed (${err.message}). It'll show "NO PREVIEW" until fixed.`)
    }
  }

  const tagLabel = aiGuessed ? 'AI-guessed, not confirmed' : 'Manually tagged'
  const actionLabel = isUpdate ? 'Updated existing' : 'Saved new'
  console.log(`  ${actionLabel}: "${scraped.title}" — ${finalTechniques.join(', ') || '(no technique)'} / ${finalSkill || '(no skill level)'} / ${finalNiche || '(no niche)'} / ${finalUseCases.join(', ') || '(no use case)'} [${tagLabel}]`)

  return {
    title: scraped.title,
    url,
    techniques: finalTechniques,
    skill: finalSkill,
    niche: finalNiche,
    useCases: finalUseCases,
    aiGuessed,
    nicheNeedsReview,
    nicheTypedValue,
    useCaseNeedsReview,
    rawRow: raw,
  }
}

// rl.question() attaches a fresh one-shot 'line' listener per call, so when
// multiple lines arrive in a single burst (e.g. pasting several rows at
// once), any lines beyond the first can fire before the next question() is
// listening and get silently dropped. A single persistent listener can't
// miss buffered events like that.
function readLinesUntilBlank(rl) {
  return new Promise((resolve) => {
    const lines = []
    function onLine(line) {
      if (!line.trim()) {
        rl.off('line', onLine)
        resolve(lines)
      } else {
        lines.push(line.trim())
      }
    }
    rl.on('line', onLine)
  })
}

async function main() {
  console.log('Paste rows as "link, technique(s), skill, best_match_tutorial_url, niche, use_case(s)" (comma- or tab-separated; everything but the link is optional). Blank line when done:\n')
  const rows = await readLinesUntilBlank(rl)

  const results = []
  for (const raw of rows) {
    const result = await processRow(raw)
    if (result) results.push(result)
  }

  console.log(`\nDone. Saved ${results.length} of ${rows.length} row(s).`)

  const aiGuessed = results.filter((r) => r.aiGuessed)
  if (aiGuessed.length > 0) {
    console.log(`\n${aiGuessed.length} AI-guessed — spot-check these:`)
    for (const r of aiGuessed) {
      console.log(`  - ${r.title} (${r.url})`)
    }
  }

  const nicheNeedsReview = results.filter((r) => r.nicheNeedsReview)
  if (nicheNeedsReview.length > 0) {
    console.log(`\n${nicheNeedsReview.length} niche value(s) need review — fix and re-paste these rows:`)
    for (const r of nicheNeedsReview) {
      console.log(`  "${r.title}" (${r.url})`)
      console.log(`    you typed: "${r.nicheTypedValue}"`)
      console.log(`    row to fix and re-paste:\n    ${r.rawRow}`)
    }
  }

  const useCaseNeedsReview = results.filter((r) => r.useCaseNeedsReview.length > 0)
  if (useCaseNeedsReview.length > 0) {
    console.log(`\n${useCaseNeedsReview.length} row(s) with use_case value(s) needing review — fix and re-paste these rows:`)
    for (const r of useCaseNeedsReview) {
      console.log(`  "${r.title}" (${r.url})`)
      console.log(`    you typed: ${r.useCaseNeedsReview.map((v) => `"${v}"`).join(', ')}`)
      console.log(`    row to fix and re-paste:\n    ${r.rawRow}`)
    }
  }

  rl.close()
}

main().catch((err) => {
  console.error('Script crashed:', err)
  process.exit(1)
})
