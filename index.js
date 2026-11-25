require('dotenv').config();
const { getTodayPlan } = require('./lib/prayer');
const { nextIndex } = require('./lib/state');
const { loadStateAsync, markSentAsync } = require('./lib/state-store');
const { imageUrl, captionForAsync, getLastCaptionSource } = require('./lib/images');
const { connect, sendImageToGroup } = require('./lib/whatsapp');
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isCheck = args.includes('--check');
const isDaemon = args.includes('--daemon');
const isSendNow = args.includes('--send-now');
const forceImageArg = args.find(a => a.startsWith('--image='));

function fmt(d) {
  return d.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function doSend(plan, imageNumber, state) {
  const url = imageUrl(imageNumber);
  const caption = await captionForAsync(imageNumber, plan.today);
  console.log(`Image #${imageNumber}: ${url}`);
  console.log(`Caption source: ${getLastCaptionSource()}`);
  console.log(`Caption: ${caption}`);
  if (isDryRun) {
    console.log('[dry-run] Not sending to WhatsApp.');
    return false;
  }
  const sock = await connect();
  try {
    await sendImageToGroup(sock, process.env.GROUP_JID, url, caption);
  } finally {
    try { sock.end(); } catch {}
  }
  await markSentAsync(state, imageNumber, plan.today);
  console.log(`Done. Next time will send #${(imageNumber % Number(process.env.MAX_IMAGES || 999)) + 1}`);
  return true;
}

async function runOnce() {
  // Re-read .env on every check, so editing CAPTION_TEMPLATE / FRIDAY_TEXT
  // while the daemon (npm start) is running applies on the next check,
  // without restarting the bot.
  require('dotenv').config({ override: true });
  if (!process.env.GROUP_JID && !isDryRun) throw new Error('GROUP_JID is missing in .env — run: npm run list-groups');
  const plan = await getTodayPlan();
  const state = await loadStateAsync();
  const imageNumber = forceImageArg
    ? Number(forceImageArg.split('=')[1])
    : nextIndex(state);

  console.log(`Today (Cairo): ${plan.today} — Hijri: ${plan.hijri}`);
  console.log(`State: ${state._source} — last sent: #${state.lastSentImage || '-'} on ${state.lastSentDate || '-'}`);
  console.log(`${plan.prayer} in Cairo: ${plan.maghrib} — target (Maghrib + ${plan.delayMinutes}m): ${fmt(plan.target)}`);
  console.log(`Now (Cairo): ${fmt(plan.now)} — in window: ${plan.isInWindow} — already sent today: ${state.lastSentDate === plan.today}`);
  console.log(`Next image: #${imageNumber}`);

  if (isSendNow) {
    console.log('--send-now: sending now, ignoring prayer time.');
    await doSend(plan, imageNumber, state);
    return;
  }
  if (isDryRun) {
    await doSend(plan, imageNumber, state);
    return;
  }
  if (!plan.isInWindow) {
    console.log('Not time yet. Nothing sent.');
    return;
  }
  if (state.lastSentDate === plan.today) {
    console.log('Already sent today. Nothing sent.');
    return;
  }
  await doSend(plan, imageNumber, state);
}

async function runDaemon() {
  console.log('Daemon started. Checking every 60 seconds. Press Ctrl+C to stop.');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await runOnce();
    } catch (e) {
      console.error('Check failed:', e.message);
    }
    await new Promise(r => setTimeout(r, 60 * 1000));
  }
}

(async () => {
  try {
    if (isDaemon) await runDaemon();
    else await runOnce();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
