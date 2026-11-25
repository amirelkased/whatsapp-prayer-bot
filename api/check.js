// Vercel serverless endpoint: GET /api/check
// On Vercel, env vars are injected automatically; locally, load .env.
require('dotenv').config();
// Returns whether it is time to send, what image is next, and its URL.
// It does NOT send to WhatsApp itself — see README "Vercel + Supabase".
// Why: Baileys needs a persistent WhatsApp Web connection, which a
// short-lived Vercel function cannot hold. Use this endpoint as:
//  - a status page / dashboard check, or
//  - a trigger: your always-on worker (VPS) polls it every minute and
//    sends when due=true, or
//  - a Vercel Cron/Schedules target that only logs the check.
// Query: ?dry=1 (default) — just check. No ?send support here on purpose.
const { getTodayPlan } = require('../lib/prayer');
const { nextIndex } = require('../lib/state');
const { loadStateAsync } = require('../lib/state-store');
const { imageUrl, captionForAsync } = require('../lib/images');

module.exports = async (req, res) => {
  try {
    // Optional shared secret so not everyone can hit the endpoint:
    // set CRON_SECRET in Vercel env, then call /api/check?secret=...
    if (process.env.CRON_SECRET && req.query.secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    const plan = await getTodayPlan();
    const state = await loadStateAsync();
    const imageNumber = nextIndex(state);
    const due = plan.isInWindow && state.lastSentDate !== plan.today;
    res.status(200).json({
      ok: true,
      today: plan.today,
      hijri: plan.hijri,
      maghrib: plan.maghrib,
      target: plan.target.toISOString(),
      nowCairo: plan.now.toISOString(),
      isInWindow: plan.isInWindow,
      alreadySentToday: state.lastSentDate === plan.today,
      due,
      stateSource: state._source,
      nextImage: imageNumber,
      imageUrl: imageUrl(imageNumber),
      caption: await captionForAsync(imageNumber, plan.today),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
