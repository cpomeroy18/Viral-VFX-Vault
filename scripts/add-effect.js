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
// Placeholder — confirm the right actor ID with Claude Code before relying
// on TikTok links, same as we did for the Instagram one.
const TIKTOK_ACTOR_ID = env.TIKTOK_ACTOR_ID || 'clockworks/tiktok-scraper'

const BUCKET = 'thumbnails'
const TECHNIQUES = [
  'Match Cut', 'Masking', 'Remove BG', 'Speed Tool',
  'Reverse', 'Green Screen', 'Splice', 'Color Change', 'Keyframes',
]

const NICHES = [
  'Fitness', 'Beauty/Skincare', 'Fashion', 'Food/Cooking', 'Real Estate',
  'Restaurant/Bar', 'Tattoo Shop', 'Barber/Salon', 'Travel', 'Comedy',
  'Personal Finance', 'Home/DIY', 'Automotive', 'Pets', 'Parenting/Family',
  'Tech/App', 'Music', 'Sports', 'Video/Editing', 'Storytelling/Personality',
  'Vlog/Personal', 'Other',
]

const USE_CASES = [
  'Hook/Attention-Grabber', 'Outfit/Clothing Reveal', 'Product Showcase',
  'Before/After Reveal', 'Comedic Punchline', 'Storytelling Beat',
  'Transition Between Scenes', 'Spice-Up/Rewatch Value', 'Call-to-Action Moment',
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

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function isTikTok(url) {
  return url.includes('tiktok.com')
}

async function scrape(url) {
  const actorId = isTikTok(url) ? TIKTOK_ACTOR_ID : INSTAGRAM_ACTOR_ID
  const run = await apify.actor(actorId).call({
    username: [url],
    resultsLimit: 1,
  })
  const { items } = await apify.dataset(run.defaultDatasetId).listItems()
  const item = items[0]
  if (!item) return null
  return {
    title: item.caption?.slice(0, 120) || item.text?.slice(0, 120) || '(no caption)',
    caption: item.caption || item.text || '',
    thumbnailUrl: item.displayUrl || item.thumbnailUrl || item.videoMeta?.coverUrl || null,
    // apify/instagram-reel-scraper returns videoPlayCount (the public "plays"
    // number shown on the reel) AND a separate, smaller videoViewCount —
    // we use videoPlayCount as views_count since it's the one Instagram
    // surfaces publicly. clockworks/tiktok-scraper's field names (playCount
    // etc.) are unverified — same caveat as TIKTOK_ACTOR_ID above, confirm
    // once we test a real TikTok link.
    viewsCount: item.videoPlayCount ?? item.playCount ?? item.videoViewCount ?? null,
    likesCount: item.likesCount ?? item.diggCount ?? null,
    commentsCount: item.commentsCount ?? item.commentCount ?? null,
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
  "techniques": [{"name": "<one of: ${TECHNIQUES.join(', ')}>", "confidence": <0-100>}],
  "skill_level": "<Easy|Medium|Advanced>",
  "niche": {"name": "<one of: ${NICHES.join(', ')}>", "confidence": <0-100>},
  "use_cases": [{"name": "<one of: ${USE_CASES.join(', ')}>", "confidence": <0-100>}],
  "reasoning": "<one sentence>"
}

"niche" is the type of creator/business the video is for — pick exactly one, "Other" if nothing fits. "use_cases" is what the effect is doing for the video (can be more than one). Only include techniques/use_cases you have real signal for from the caption. If the caption gives little to go on, say so honestly with low confidence rather than guessing.`

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

  // Only call out to Claude for whatever wasn't supplied on the row.
  if (givenTechniques.length === 0 || !givenSkill || !givenNiche || givenUseCases.length === 0) {
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
  }

  const aiGuessed = techniqueGuessed || skillGuessed || nicheGuessed || useCaseGuessed
  finalTechniques = finalTechniques.map(canonicalizeTechnique)
  finalNiche = finalNiche ? canonicalizeNiche(finalNiche) : finalNiche
  finalUseCases = finalUseCases.map(canonicalizeUseCase)

  // Auto-fill the generic tutorial link from the first technique.
  const referenceTutorial = tutorialMap[finalTechniques[0]] || null
  if (!referenceTutorial) {
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
    niche: finalNiche || null,
    use_case: finalUseCases.join(', ') || null,
    // Only set when given — blank/missing means "leave untouched", not
    // "clear it out", especially on update.
    ...(bestMatchTutorialUrl ? { best_match_tutorial_url: bestMatchTutorialUrl } : {}),
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

  rl.close()
}

main().catch((err) => {
  console.error('Script crashed:', err)
  process.exit(1)
})
