# VFX Vault

React + Vite app backed by Supabase.

## Deployment

- GitHub: `cpomeroy18/Viral-VFX-Vault` (main branch)
- Vercel project: `colin-pomeroy/vfx-vault`, connected to GitHub — every push to `main` auto-deploys
- Live URL: https://vfx-vault-nu.vercel.app
- This is a commercial site. If the Vercel account is on the free Hobby plan, that violates Vercel's ToS (Hobby is for non-commercial use only) — needs Pro.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set in Vercel for Production/Preview/Development. Being `VITE_`-prefixed, they're bundled into client JS and publicly visible — expected/fine since it's the anon key, gated by Supabase RLS.
- **Vercel "Sensitive" environment variables can never be read back — by anyone, ever, through any channel.** Not the dashboard, not the CLI, not `vercel env pull`. They're write-only: usable by deployments at runtime, unreadable afterward. `vercel env pull` returns `""` for them on old CLI versions and the literal string `"[SENSITIVE]"` on newer ones — both look like something's broken, but neither is. If a variable in this project might be Sensitive-typed (several already are — `GHL_API_KEY`, `GHL_LOCATION_ID`, `GHL_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`), don't try to inspect its value locally to debug something — hit the live endpoint and read Vercel's function logs (`vercel logs <url>`) instead, which do show real runtime errors (e.g. GHL's actual 401/403 responses).

## Effect ingestion script (`scripts/add-effect.js`)

The core "add new effect" pipeline — paste rows, it scrapes + tags + saves to Supabase. Row format (tab- or comma-separated, auto-detected):

```
link, technique(s), skill, best_match_tutorial_url, niche, use_case(s), notes
```

Only `link` is required. Multiple `technique`/`use_case` values within their field are `;`-separated (not `,` — comma is already the row separator in comma-mode). Re-pasting a link that's already saved **updates** that row instead of duplicating it.

- **`notes`** (7th column) is manual-only — never AI-guessed, blank always just stays blank, same "leave untouched on a blank re-paste" behavior as `best_match_tutorial_url`. It reuses the `effects.notes` column, which already existed and was already populated on ~100 rows (old how-to text/reference links) before this column got wired up to the paste format — no migration was needed. It's also the one field that's free text rather than a constrained value, so a comma inside a note will break a comma-separated row; stick to tab-separated pastes if a note might contain one.
- **AI fallback**: any of technique/skill/niche/use_case left blank gets AI-guessed from the scraped caption via `scripts/technique-rulebook.md` — but only if there's an actual caption to read; if the scrape comes back with no caption/thumbnail/stats at all, nothing gets guessed and the row is logged as "Insufficient data to auto-tag — needs manual review" instead of fabricating a low-signal tag.
- **niche/use_case validation**: manually-typed values are checked against fixed lists (exact match → normalized match → one-clear-fuzzy-match-typo, in that order, each auto-corrected except the first which is silent). Anything that doesn't confidently match gets flagged (not saved) and listed at the end of the run with the exact original row text, ready to fix and re-paste. Prefix a value with `new:` (e.g. `new:Local SEO`) to explicitly force-save it as a genuinely new, off-list category. Template is excluded from AI-guessing entirely — it can only be identified by watching for an on-screen badge, never from caption/metadata.
- **TikTok is supported** — `clockworks/tiktok-scraper` needs `postURLs` as the input field (not `username`, which is Instagram's actor's field), and its stat/thumbnail/date field names differ (`playCount`/`diggCount`/`commentCount`/`videoMeta.coverUrl`/`createTimeISO` vs Instagram's `videoPlayCount`/`likesCount`/`commentsCount`/`displayUrl`/`timestamp`) — both are already handled in `scrape()`.
- **`scripts/technique-rulebook.md`** is meant to be the single source of truth for the AI's technique/niche/use_case definitions, but it's just prose documentation — the actual fixed lists (`TECHNIQUES`/`NICHES`/`USE_CASES`) live in the code and get injected into the AI prompt directly, so the rulebook file can drift out of sync (it already has once, losing its Niche/Use Case sections during a manual edit) without breaking anything functionally. Worth eyeballing occasionally, not load-bearing.

## Thumbnail backfill script (`scripts/backfill-thumbnails.js`)

One-time/reusable script: finds `effects` rows with `thumbnail_url IS NULL`, scrapes a fresh thumbnail via Apify, uploads it to Supabase Storage, and saves the permanent URL back. Run locally only — never deploy this file or its env to Vercel. Works for both Instagram and TikTok links (same actor/field-name choices as `add-effect.js`'s `scrape()`).

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

**Supabase Storage**: thumbnails are uploaded to a bucket named `thumbnails`, which must be `public: true` (the script calls `getPublicUrl()` and assumes public access).

**Known persistently-failing rows**: as of the last backfill, ~11 effects still lack a thumbnail — Instagram links the scraper couldn't resolve (likely deleted/private posts). Retrying the script won't fix these; they need manual investigation. (TikTok links used to be a second failure category here too, but that's fixed now — see the Apify actor gotcha in the add-effect.js section above.)

## Stats backfill script (`scripts/backfill-stats.js`)

Same pattern as the thumbnail backfill: finds `effects` rows missing `views_count`/`likes_count`/`comments_count`, scrapes fresh values via Apify, and saves them back. Works for both Instagram and TikTok links. `views_count` is mapped from Instagram's `videoPlayCount` field (the public "plays" number shown on the reel) or TikTok's `playCount` — not Instagram's separate, smaller `videoViewCount` field.

**Known persistently-failing rows**: same ~11 unresolvable Instagram links as the thumbnail backfill. This script treats "got any item back from Apify" as success even when all fields end up null (a real quirk, not a bug worth fixing) — so its own reported success/fail counts aren't fully trustworthy; verify against actual DB state if precision matters.

`scripts/add-effect.js` also saves these three columns automatically on every new effect it inserts or updates, so this backfill script is only needed for effects added before stats tracking existed.

## Date-posted backfill script (`scripts/backfill-date-posted.js`)

Same pattern again: finds `effects` rows missing `date_posted` (when the original video was posted, distinct from `date_added` which is when it was added to the vault), scrapes it via Apify, and saves it back. Works for both Instagram (`timestamp` field) and TikTok (`createTimeISO` field) links.

**Known persistently-failing rows**: same ~11 unresolvable Instagram links. Unlike `backfill-stats.js`, this script correctly counts "Apify returned no timestamp" as a real failure rather than silently saving null as a false success, so its reported success/fail counts can be trusted directly.

`scripts/add-effect.js` also saves `date_posted` automatically on every new effect it inserts or updates, so this backfill script is only needed for effects added before date-posted tracking existed.

## API endpoints (`api/*.js`)

Vercel serverless functions — anything in `/api` becomes a live endpoint automatically. All three need `SUPABASE_SERVICE_ROLE_KEY` since they bypass RLS server-side (the browser can't do this with the anon key).

| File | Direction | Purpose | Extra env vars |
|---|---|---|---|
| `ghl-webhook.js` | GHL → us | Fires when someone pays for the course; adds their email to `authorized_users` | `GHL_WEBHOOK_SECRET` (shared secret, checked against an `x-webhook-secret` header GHL sends) |
| `check-authorized.js` | Browser → us | `LoginGate.jsx` calls this to check whether a typed email is in `authorized_users` before letting a tutorial/example link open | none beyond the service role key |
| `ghl-add-lead.js` | Us → GHL | Fires (fire-and-forget, never blocks the UI) whenever someone submits the free-browse `EmailGate`; upserts them as a GHL contact and tags `"VFX Vault - Browsed, Not Purchased"` via GHL's separate Add Tags endpoint (not the upsert's own `tags` field, which **overwrites** all existing tags instead of adding to them) | `GHL_API_KEY` (Private Integration Token, sub-account-scoped), `GHL_LOCATION_ID` |

GHL API v2 base URL is `https://services.leadconnectorhq.com`, needs an `Authorization: Bearer <token>` header plus a `Version: 2021-07-28` header on every call.

## Frontend architecture notes

- **Two independent, unrelated gates exist** — don't conflate them. `EmailGate` is free-browse lead capture (saves to `vault_leads`, unlocks with `localStorage.vfx_vault_email`, syncs to GHL via `ghl-add-lead.js`). `LoginGate` is purchase verification (checks `authorized_users` via `check-authorized.js`, unlocks with `localStorage.vfx_vault_authorized_email`) and gates individual outbound links (thumbnail, tutorial button, example button) in `EffectCard.jsx`, not the whole page. `StatusBadges.jsx` shows the state of both independently.
- **React footgun**: never pass a `useState` setter directly as a callback prop when the caller might invoke it with a function argument (e.g. `onRequireAuth={setPendingAction}`). React treats a bare function argument to a setter as a *functional updater* and calls it immediately with the previous state — so `onRequireAuth(() => window.open(url))` becomes `setPendingAction(() => window.open(url))`, which fires `window.open` right away as a side effect instead of storing the callback. Wrap it: `onRequireAuth={(action) => setPendingAction(() => action)}`. Real bug, cost real debugging time — see `App.jsx`'s inline comment at the `onRequireAuth` prop.
- **Filter options are derived from live data, not hardcoded.** The niche/use_case dropdown filters (`MultiSelectFilter.jsx`) compute their option lists from the distinct values actually present in loaded `effects`, rather than duplicating `NICHES`/`USE_CASES` from `add-effect.js` into the frontend. Follow this pattern for any future filterable field — technique already has a duplicated list (`TECHNIQUES` in `src/lib/techniques.js`, kept in sync by hand with `add-effect.js`) and that's a known, only-partly-load-bearing wart (it also carries per-technique display colors, which is why it exists as a real constant rather than being derived).
- **Anchored popovers inside `EffectCard.jsx` must not use a fixed width.** The card's outer container has `overflow-hidden` (needed to clip the thumbnail to its rounded corners) — any absolutely-positioned popover wider than the card gets silently *clipped*, not wrapped or pushed outside. The notes popover uses `w-full` (sized to the card's own content width) instead of a fixed `w-72`-style width for exactly this reason. This bug can't be caught by the Vitest/RTL suite — jsdom doesn't do real layout/rendering — so it has to be reasoned through by hand or checked in a real browser. There are now two independent instances of the same "toggle button + anchored panel, close on outside-click/Escape" pattern (`MultiSelectFilter.jsx` and the notes popover inline in `EffectCard.jsx`) — worth extracting into one shared component if a third shows up.

## Testing

`npm test` runs the Vitest + React Testing Library suite (`src/*.test.jsx`). Pattern used throughout: render the real `App`/component tree and drive it with real `fireEvent` interactions, mocking only true external boundaries (`./lib/supabase`, `global.fetch`) — not the app's own logic. When adding a test, sanity-check it isn't hollow by temporarily breaking the feature it covers and confirming the test actually fails before reverting.

## Repo hygiene

- `.gitignore` uses a broad `.env*` rule (added by the Vercel CLI on `vercel link`) with explicit re-includes for template files: `!.env.example` and `!*/.env.*.example`. Keep these re-includes if editing `.gitignore` — otherwise new `.env.*.example` templates silently stop being committable.
