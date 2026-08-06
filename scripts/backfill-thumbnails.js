// scripts/backfill-thumbnails.js
//
// One-time (and reusable) script: for every effect missing a thumbnail,
// fetch a fresh thumbnail URL from Apify, download the actual image,
// upload it to Supabase Storage (permanent), and save that permanent
// URL back onto the effect row. Instagram/TikTok's own thumbnail links
// expire after a day or two — this script exists specifically to stop
// relying on those.
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
//   node scripts/backfill-thumbnails.js

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

const BUCKET = 'thumbnails'

async function fetchThumbnailUrl(videoLink) {
  const run = await apify.actor(APIFY_ACTOR_ID).call({
    username: [videoLink],
    resultsLimit: 1,
  })
  const { items } = await apify.dataset(run.defaultDatasetId).listItems()
  const item = items[0]
  return item?.displayUrl || null
}

async function downloadImage(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function uploadToSupabase(effectId, imageBuffer) {
  const path = `${effectId}.jpg`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, imageBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

async function main() {
  console.log('Fetching effects missing thumbnails...')
  const { data: effects, error } = await supabase
    .from('effects')
    .select('id, title, video_link, thumbnail_url')
    .is('thumbnail_url', null)

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

      const freshThumbUrl = await fetchThumbnailUrl(effect.video_link)
      if (!freshThumbUrl) {
        console.log('   skipped: Apify returned no thumbnail')
        failed++
        continue
      }

      const imageBuffer = await downloadImage(freshThumbUrl)
      const permanentUrl = await uploadToSupabase(effect.id, imageBuffer)

      const { error: updateError } = await supabase
        .from('effects')
        .update({ thumbnail_url: permanentUrl })
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
