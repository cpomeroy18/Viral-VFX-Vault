// scripts/backfill-date-posted.js
//
// One-time (and reusable) script: for every effect missing date_posted
// (when the original video was posted, distinct from date_added), fetch it
// from Apify and save it. Same pattern as backfill-stats.js.
//
// Works for both Instagram and TikTok links (same actor/field-name choices
// as add-effect.js's scrape()).
//
// Run locally only. Never deploy this file or its .env to Vercel.
//
// Setup:
//   npm install @supabase/supabase-js apify-client
//   Create scripts/.env.backfill (gitignored) with:
//     SUPABASE_URL=...
//     SUPABASE_SERVICE_ROLE_KEY=...
//     APIFY_TOKEN=...
//
// Run:
//   node scripts/backfill-date-posted.js

import { createClient } from '@supabase/supabase-js'
import { ApifyClient } from 'apify-client'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// --- tiny .env loader so we don't need an extra dependency ---
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

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const apify = new ApifyClient({ token: env.APIFY_TOKEN })

// Change this if you use a different scraper actor than Apify's
// general-purpose Instagram Reel Scraper.
const INSTAGRAM_ACTOR_ID = 'apify/instagram-reel-scraper'
const TIKTOK_ACTOR_ID = env.TIKTOK_ACTOR_ID || 'clockworks/tiktok-scraper'

function isTikTok(url) {
  return url.includes('tiktok.com')
}

async function fetchDatePosted(videoLink) {
  const actorId = isTikTok(videoLink) ? TIKTOK_ACTOR_ID : INSTAGRAM_ACTOR_ID
  const input = isTikTok(videoLink)
    ? { postURLs: [videoLink], resultsPerPage: 1 }
    : { username: [videoLink], resultsLimit: 1 }
  const run = await apify.actor(actorId).call(input)
  const { items } = await apify.dataset(run.defaultDatasetId).listItems()
  const item = items[0]
  if (!item) return null
  // item.timestamp is apify/instagram-reel-scraper's field; createTimeISO
  // is clockworks/tiktok-scraper's equivalent — see the comment in
  // add-effect.js's scrape() for the same choice.
  return item.timestamp ?? item.createTimeISO ?? item.createTime ?? null
}

async function main() {
  console.log('Fetching effects missing date_posted...')
  const { data: effects, error } = await supabase
    .from('effects')
    .select('id, title, video_link, date_posted')
    .is('date_posted', null)

  if (error) throw error
  console.log(`Found ${effects.length} effects to process.\n`)

  let success = 0
  let failed = 0

  for (const effect of effects) {
    try {
      console.log(`→ ${effect.title}`)

      if (!effect.video_link) {
        console.log('   skipped: no video_link')
        failed++
        continue
      }

      const datePosted = await fetchDatePosted(effect.video_link)
      if (!datePosted) {
        console.log('   skipped: Apify returned no timestamp')
        failed++
        continue
      }

      const { error: updateError } = await supabase
        .from('effects')
        .update({ date_posted: datePosted })
        .eq('id', effect.id)

      if (updateError) throw updateError

      console.log('   done')
      success++
    } catch (err) {
      console.log(`   failed: ${err.message}`)
      failed++
    }

    // Small delay to stay polite to Apify/Instagram rate limits.
    await new Promise((r) => setTimeout(r, 1500))
  }

  console.log(`\nDone. ${success} succeeded, ${failed} failed.`)
}

main().catch((err) => {
  console.error('Script crashed:', err)
  process.exit(1)
})
