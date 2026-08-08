# VFX Vault

React + Vite app backed by Supabase.

## Deployment

- GitHub: `cpomeroy18/Viral-VFX-Vault` (main branch)
- Vercel project: `colin-pomeroy/vfx-vault`, connected to GitHub — every push to `main` auto-deploys
- Live URL: https://vfx-vault-nu.vercel.app
- This is a commercial site. If the Vercel account is on the free Hobby plan, that violates Vercel's ToS (Hobby is for non-commercial use only) — needs Pro.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set in Vercel for Production/Preview/Development. Being `VITE_`-prefixed, they're bundled into client JS and publicly visible — expected/fine since it's the anon key, gated by Supabase RLS.

## Thumbnail backfill script (`scripts/backfill-thumbnails.js`)

One-time/reusable script: finds `effects` rows with `thumbnail_url IS NULL`, scrapes a fresh thumbnail via Apify, uploads it to Supabase Storage, and saves the permanent URL back. Run locally only — never deploy this file or its env to Vercel.

Setup:
```
npm install @supabase/supabase-js apify-client
```
Create `scripts/.env.backfill` (gitignored, template at `scripts/.env.backfill.example`):
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # full admin access, bypasses RLS — never paste into chat, edit the file directly
APIFY_TOKEN=...
```

Run: `node scripts/backfill-thumbnails.js`

**Apify actor gotcha**: the script uses `apify/instagram-reel-scraper`. Its input field is `username` — an array that accepts usernames, profile URLs, IDs, *or* direct reel URLs — **not** `directUrls`. The thumbnail comes back on the output field `displayUrl`. This is a different input schema than the older `apify/instagram-post-scraper` actor; don't assume `directUrls` works here.

**Instagram-only**: this actor can't process TikTok links. Some `effects.video_link` values point to TikTok — those will always fail with "Apify returned no thumbnail" via this script. As of the last backfill run, at least 8 known effects are TikTok links and need a different approach (different actor, or manual thumbnail upload).

**Supabase Storage**: thumbnails are uploaded to a bucket named `thumbnails`, which must be `public: true` (the script calls `getPublicUrl()` and assumes public access).

**Known persistently-failing rows**: as of the last backfill, ~18 of 103 effects still lack a thumbnail — some are TikTok links (see above), the rest are Instagram links the scraper couldn't resolve (likely deleted/private posts). Retrying the script won't fix these; they need manual investigation.

## Stats backfill script (`scripts/backfill-stats.js`)

Same pattern as the thumbnail backfill: finds `effects` rows missing `views_count`/`likes_count`/`comments_count`, scrapes fresh values via Apify (`apify/instagram-reel-scraper`), and saves them back. Instagram-only, same limitation as the thumbnail script — can't process TikTok links. `views_count` is mapped from the actor's `videoPlayCount` field (the public "plays" number Instagram shows on the reel), not the separate, smaller `videoViewCount` field the actor also returns.

**Known persistently-failing rows**: as of the last backfill (106 effects processed), 19 still have null stats — 8 are TikTok links (expected, same as thumbnails), the other 11 are Instagram links the scraper couldn't resolve. This is largely the same set of problem links as the thumbnail backfill's persistently-failing rows. Retrying won't fix these; same manual-investigation caveat applies.

`scripts/add-effect.js` also saves these three columns automatically (via the same `videoPlayCount` mapping) on every new effect it inserts or updates, so this backfill script is only needed for effects added before stats tracking existed.

## Date-posted backfill script (`scripts/backfill-date-posted.js`)

Same pattern again: finds `effects` rows missing `date_posted` (when the original video was posted, distinct from `date_added` which is when it was added to the vault), scrapes it via Apify (`apify/instagram-reel-scraper`, field `timestamp`), and saves it back. Instagram-only, same TikTok limitation as the other two backfill scripts.

**Known persistently-failing rows**: as of the last backfill (106 effects processed), 19 still have null `date_posted` — the same 8 TikTok + 11 unresolvable-Instagram links as the stats and thumbnail backfills. Unlike `backfill-stats.js`, this script correctly counts "Apify returned no timestamp" as a real failure rather than silently saving null as a false success, so its reported success/fail counts can be trusted directly.

`scripts/add-effect.js` also saves `date_posted` automatically (via the same `timestamp` field) on every new effect it inserts or updates, so this backfill script is only needed for effects added before date-posted tracking existed.

## Repo hygiene

- `.gitignore` uses a broad `.env*` rule (added by the Vercel CLI on `vercel link`) with explicit re-includes for template files: `!.env.example` and `!*/.env.*.example`. Keep these re-includes if editing `.gitignore` — otherwise new `.env.*.example` templates silently stop being committable.
