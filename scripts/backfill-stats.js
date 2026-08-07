// scripts/backfill-stats.js
//
// One-time (and reusable) script: for every effect missing view/like/comment
// counts, fetch fresh stats from Apify and save them onto the effect row.
// Same pattern as backfill-thumbnails.js — this is the stats equivalent.
//
// Instagram-only, same as backfill-thumbnails.js: apify/instagram-reel-scraper
// can't process TikTok links, so any effect with a TikTok video_link will
// always fail here. Needs a different approach (different actor) for those.
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
//   node scripts/backfill-stats.js

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
const APIFY_ACTOR_ID = 'apify/instagram-reel-scraper'

async function fetchStats(videoLink) {
  const run = await apify.actor(APIFY_ACTOR_ID).call({
    username: [videoLink],
    resultsLimit: 1,
  })
  const { items } = await apify.dataset(run.defaultDatasetId).listItems()
  const item = items[0]
  if (!item) return null
  return {
    // videoPlayCount is the public "plays" number shown on the reel;
    // videoViewCount is a separate, smaller Apify field — videoPlayCount
    // is what we use for views_count (same choice made in add-effect.js).
    viewsCount: item.videoPlayCount ?? item.videoViewCount ?? null,
    likesCount: item.likesCount ?? null,
    commentsCount: item.commentsCount ?? null,
  }
}

async function main() {
  console.log('Fetching effects missing stats...')
  const { data: effects, error } = await supabase
    .from('effects')
    .select('id, title, video_link, views_count, likes_count, comments_count')
    .or('views_count.is.null,likes_count.is.null,comments_count.is.null')

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

      const stats = await fetchStats(effect.video_link)
      if (!stats) {
        console.log('   skipped: Apify returned no data')
        failed++
        continue
      }

      const { error: updateError } = await supabase
        .from('effects')
        .update({
          views_count: stats.viewsCount,
          likes_count: stats.likesCount,
          comments_count: stats.commentsCount,
        })
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
