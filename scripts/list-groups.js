require('dotenv').config();
const { connect } = require('../lib/whatsapp');

(async () => {
  const sock = await connect();
  const groups = await sock.groupFetchAllParticipating();
  console.log('\nYour groups:');
  for (const [jid, g] of Object.entries(groups)) {
    console.log(`- ${g.subject}  ->  ${jid}`);
  }
  console.log('\nCopy the JID of your group into .env as GROUP_JID');
  try { sock.end(); } catch {}
  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
