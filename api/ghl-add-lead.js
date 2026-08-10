// api/ghl-add-lead.js
//
// Called from the browser by EmailGate.jsx right after a free-browse lead
// is saved to Supabase's `vault_leads` table. Upserts that same email as a
// GoHighLevel contact and applies the tag "VFX Vault - Browsed, Not
// Purchased" so they can be worked as a lead. Separate from
// api/ghl-webhook.js, which goes the other direction (GHL -> us, when
// someone actually buys) and writes to `authorized_users`, not
// `vault_leads`.
//
// This runs as a Vercel serverless function — anything in the /api folder
// becomes a live endpoint at https://vfx-vault-nu.vercel.app/api/ghl-add-lead
//
// Uses GoHighLevel's API v2 (https://services.leadconnectorhq.com), two
// calls:
//   1. POST /contacts/upsert - creates the contact if new, or finds the
//      existing one by email if not. Deliberately does NOT send `tags` on
//      this call — GHL's upsert `tags` field OVERWRITES all tags already
//      on the contact rather than adding to them, which would wipe out
//      anything applied by other automations/funnels.
//   2. POST /contacts/:id/tags - the dedicated "add tag" endpoint, which
//      is additive and leaves existing tags alone.
//
// Env vars needed (Vercel Dashboard -> your project -> Settings ->
// Environment Variables) — see the top-level chat message for exactly
// where to find these in your GHL account:
//   GHL_API_KEY       Private Integration Token for the GHL sub-account
//   GHL_LOCATION_ID    That sub-account's Location ID
//
// SECURITY NOTE: GHL_API_KEY grants write access to your CRM contacts.
// Server-side only, same handling as SUPABASE_SERVICE_ROLE_KEY elsewhere
// in this project — never expose it to the browser.
//
// Fails silently from the visitor's perspective by design — EmailGate.jsx
// fires this without awaiting or blocking the unlock on it. Failures are
// logged here (visible in Vercel's function logs / Vercel dashboard ->
// your project -> Logs) so sync health is checkable without ever
// affecting who gets into the vault.

const GHL_BASE = 'https://services.leadconnectorhq.com'
const GHL_VERSION = '2021-07-28'
const LEAD_TAG = 'VFX Vault - Browsed, Not Purchased'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body || {}
  const email = (body.email || '').trim().toLowerCase()

  if (!email) {
    return res.status(400).json({ error: 'No email provided' })
  }

  const headers = {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    Version: GHL_VERSION,
    'Content-Type': 'application/json',
  }

  try {
    const upsertRes = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        locationId: process.env.GHL_LOCATION_ID,
        source: 'VFX Vault website - free browse',
      }),
    })
    const upsertData = await upsertRes.json().catch(() => ({}))

    if (!upsertRes.ok) {
      console.error('GHL contact upsert failed:', upsertRes.status, upsertData)
      return res.status(502).json({ synced: false, error: 'GHL upsert failed' })
    }

    const contactId = upsertData.contact?.id
    if (!contactId) {
      console.error('GHL upsert succeeded but returned no contact id:', upsertData)
      return res.status(502).json({ synced: false, error: 'No contact id returned' })
    }

    const tagRes = await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tags: [LEAD_TAG] }),
    })

    if (!tagRes.ok) {
      const tagData = await tagRes.json().catch(() => ({}))
      console.error('GHL add-tag failed:', tagRes.status, tagData)
      return res.status(502).json({ synced: false, error: 'GHL tag apply failed' })
    }

    return res.status(200).json({ synced: true, contactId })
  } catch (err) {
    console.error('GHL lead sync crashed:', err)
    return res.status(500).json({ synced: false, error: 'Internal error' })
  }
}
