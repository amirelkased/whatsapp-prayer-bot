require('dotenv').config();
const { connect } = require('../lib/whatsapp');

(async () => {
  console.log('Logging in to WhatsApp. Scan the QR code, or use PHONE_NUMBER in .env for a pairing code.');
  const sock = await connect();
  console.log('\nLogged in. Auth is saved in ./auth — keep it safe, never commit it.');
  console.log('Next: npm run list-groups  to find your group ID.');
  try { sock.end(); } catch {}
  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
