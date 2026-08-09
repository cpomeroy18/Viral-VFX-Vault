// api/check-authorized.js
//
// Checks whether an email exists in the `authorized_users` table (i.e. has
// paid for the course). Called from the browser by LoginGate.jsx when a
// visitor tries to open a tutorial/example link.
//
// This runs as a Vercel serverless function — anything in the /api folder
// becomes a live endpoint at https://vfx-vault-nu.vercel.app/api/check-authorized
//
// Uses the Supabase SERVICE ROLE key server-side because authorized_users
// has no public policies — the browser can't query it directly with the
// anon key. Same env var as api/ghl-webhook.js:
//   Name: SUPABASE_SERVICE_ROLE_KEY
//
// No shared-secret header here (unlike ghl-webhook.js) — this endpoint is
// meant to be called directly by any visitor's browser, so a "secret"
// couldn't actually be kept secret in client-side code anyway. It only
// ever returns a boolean, never the underlying user data.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body || {}
  const email = (body.email || '').trim().toLowerCase()

  if (!email) {
    return res.status(400).json({ error: 'No email provided' })
  }

  const { data, error } = await supabase
    .from('authorized_users')
    .select('email')
    .eq('email', email)
    .maybeSingle()

  if (error) {
    console.error('Failed to check authorization:', error)
    return res.status(500).json({ error: 'Database error' })
  }

  return res.status(200).json({ authorized: !!data })
}
