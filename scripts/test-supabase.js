require('dotenv').config();
// Test Supabase connection without sending anything.
// Usage: npm run test-supabase   (add that script, or: node scripts/test-supabase.js)
// Prints only the key TYPE and length, never the key itself.
(async () => {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  console.log('SUPABASE_URL:', url || '(missing)');
  console.log('Key length:', key.length);
  console.log('Key starts with eyJ... (legacy service_role JWT):', key.startsWith('eyJ'));
  console.log('Key starts with sb_secret_... (new secret key):', key.startsWith('sb_secret_'));
  if (!url || !key) {
    console.log('\nMissing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    console.log('To test without Supabase DB, leave SUPABASE_SERVICE_ROLE_KEY empty — the bot will use local state.json.');
    process.exit(1);
  }
  if (!key.startsWith('eyJ') && !key.startsWith('sb_secret_')) {
    console.log('\nThat key is NOT a Supabase API key. Get the right one:');
    console.log('Supabase Dashboard > Settings (gear) > API > Legacy API keys > service_role  (starts with eyJ...)');
    console.log('or API Keys > Secret key  (starts with sb_secret_...)');
    console.log('Do NOT use the Postgres password, the Storage S3 secret, or the anon/publishable key here.');
    process.exit(1);
  }
  const res = await fetch(`${url}/rest/v1/bot_state?id=eq.1&select=last_index,last_sent_date,last_sent_image`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  console.log('\nbot_state status:', res.status);
  console.log('body:', (await res.text()).slice(0, 300));
  if (res.status === 401) console.log('=> 401 = wrong key. Copy it again, no spaces, no quotes.');
  if (res.status === 404) console.log('=> Table not found. Run supabase/schema.sql in Supabase > SQL Editor.');
  if (res.ok) console.log('=> Supabase OK. Now run: npm run dry-run');
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
