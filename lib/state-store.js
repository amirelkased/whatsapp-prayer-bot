// State store: Supabase Postgres if configured, otherwise local state.json.
// Supabase is the better option when the bot runs in more than one place
// (Vercel + a VPS, or GitHub Actions + a VPS): both read the same lastIndex
// and lastSentDate, so it can never double-send or restart from #1.
// Local file is fine for a single always-on machine.
const { loadState, saveState } = require('./state');

function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function headers() {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function loadStateAsync() {
  if (!supabaseConfigured()) return { ...loadState(), _source: 'local state.json' };
  const base = process.env.SUPABASE_URL.replace(/\/$/, '');
  const res = await fetch(`${base}/rest/v1/bot_state?id=eq.1&select=last_index,last_sent_date,last_sent_image`, { headers: headers() });
  if (res.status === 401) {
    throw new Error('Supabase bot_state read failed: 401 Invalid API key — SUPABASE_SERVICE_ROLE_KEY is wrong. It must be the service_role JWT (starts with eyJ...) or the new sb_secret_... key from Supabase > Settings > API. The value in .env is not that key. To keep testing now, leave SUPABASE_SERVICE_ROLE_KEY empty to use local state.json instead.');
  }
  if (res.status === 404 || res.status === 400) {
    const body = await res.text();
    throw new Error(`Supabase bot_state read failed: ${res.status} — table bot_state not found. Run supabase/schema.sql in Supabase > SQL Editor. Details: ${body.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`Supabase bot_state read failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  if (!rows[0]) return { lastIndex: 0, lastSentDate: null, lastSentImage: null, _source: 'supabase' };
  return {
    lastIndex: rows[0].last_index || 0,
    lastSentDate: rows[0].last_sent_date || null,
    lastSentImage: rows[0].last_sent_image || null,
    _source: 'supabase',
  };
}

async function markSentAsync(state, imageNumber, today) {
  const next = { lastIndex: imageNumber, lastSentDate: today, lastSentImage: imageNumber };
  if (!supabaseConfigured()) {
    saveState(next);
    return { ...next, _source: 'local state.json' };
  }
  const base = process.env.SUPABASE_URL.replace(/\/$/, '');
  const res = await fetch(`${base}/rest/v1/bot_state`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: 1, last_index: imageNumber, last_sent_date: today, last_sent_image: imageNumber }),
  });
  if (!res.ok) throw new Error(`Supabase bot_state write failed: ${res.status} ${await res.text()}`);
  return { ...next, _source: 'supabase' };
}

module.exports = { supabaseConfigured, loadStateAsync, markSentAsync };
