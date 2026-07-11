# VFX Vault — Setup Guide

Everything below is copy-paste. No coding knowledge needed.

## 1. Set up the database (Supabase)

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` in this folder, copy all of it, paste into the SQL editor, click **Run**.
3. New query again → open `supabase/import_effects.sql`, copy all of it, paste, click **Run**.
   This loads your 103 existing effects into the `effects` table.
4. Go to **Settings → API**. Copy the **Project URL** and the **anon public** key — you'll need these next.

## 2. Connect the code to your database

1. In this project folder, duplicate `.env.example` and rename the copy to `.env`
2. Open `.env` and paste in your Project URL and anon key from step 1.4.

## 3. Push this code to GitHub

1. Go to your empty GitHub repo.
2. Click **uploading an existing file**, then drag this entire project folder in
   (or, if you're comfortable with Terminal, `git init`, `git add .`, `git commit -m "first version"`, then follow GitHub's push instructions).
   Do NOT upload the `.env` file — it's already excluded via `.gitignore`, but double check it's not in what you drag over.

## 4. Deploy on Vercel

1. Go to vercel.com, sign in with GitHub, click **Add New → Project**.
2. Select this repo.
3. Before clicking deploy, open **Environment Variables** and add the same two values from your `.env` file:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy**.
5. Once live, go to your Vercel project **Settings → Billing** and confirm you're on the **Pro plan** ($20/mo) — required since this site is commercial (it captures emails / links to a paid course).

That's it — you'll have a live URL you can share.

## What's in here

- `src/App.jsx` — the whole page logic (search, filters, email gate)
- `src/components/` — the card, filter bar, and email gate UI pieces
- `src/lib/techniques.js` — the technique-to-color mapping. Add a new technique here anytime.
- `supabase/schema.sql` — creates the two database tables
- `supabase/import_effects.sql` — one-time import of your 103 existing effects

## Adding a new effect later

Go to your Supabase project → **Table Editor → effects → Insert row**. Fill in title, video_link,
main_tool_used (comma-separated if more than one, e.g. `Masking, Match Cut`), skill_level, and
reference_tutorial. It shows up on the site immediately — no redeploy needed.
