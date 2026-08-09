// api/ghl-webhook.js
//
// Receives a webhook from GoHighLevel the moment someone pays for the
// Viral VFX Vault course. Adds their email to the `authorized_users`
// table in Supabase, which the login system checks before letting
// someone access tutorial links or source videos.
//
// This runs as a Vercel serverless function automatically — anything
// in the /api folder becomes a live endpoint at
// https://vfx-vault-nu.vercel.app/api/ghl-webhook
//
// SECURITY NOTE: this endpoint uses the Supabase SERVICE ROLE key,
// which bypasses all database security rules. It must be set as a
// Vercel environment variable (server-side only) — NEVER the anon key,
// and NEVER exposed to the browser. Set it in:
// Vercel Dashboard -> your project -> Settings -> Environment Variables
//   Name: SUPABASE_SERVICE_ROLE_KEY
//   Value: (the service_role key from Supabase Settings -> API)
//
// Also set a shared secret so random internet traffic can't call this
// endpoint and fake-authorize themselves:
//   Name: GHL_WEBHOOK_SECRET
//   Value: (any long random string you make up)
// Then in GHL's webhook action, add a Header:
//   Key: x-webhook-secret   Value: (the same string)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify this request actually came from GHL, not a random visitor.
  const providedSecret = req.headers['x-webhook-secret']
  if (providedSecret !== process.env.GHL_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const body = req.body || {}
  // GHL's "standard data" payload typically includes email directly,
  // sometimes nested under contact. Handle both shapes defensively.
  const email = (body.email || body.contact?.email || '').trim().toLowerCase()

  if (!email) {
    return res.status(400).json({ error: 'No email found in webhook payload' })
  }

  const { error } = await supabase
    .from('authorized_users')
    .upsert([{ email }], { onConflict: 'email' })

  if (error) {
    console.error('Failed to authorize user:', error)
    return res.status(500).json({ error: 'Database error' })
  }

  return res.status(200).json({ success: true, email })
}
