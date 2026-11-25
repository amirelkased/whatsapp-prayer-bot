// Prayer times from Aladhan API (free, no key).
// Method 5 = Egyptian General Authority of Survey, correct for Cairo.
const TIMEZONE = process.env.TIMEZONE || 'Africa/Cairo';
const CITY = process.env.CITY || 'Cairo';
const COUNTRY = process.env.COUNTRY || 'Egypt';
const METHOD = process.env.METHOD || '5';

function cairoNow() {
  // Wall-clock time in Cairo, as a Date object.
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

function cairoTodayString(date = cairoNow()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseHHMM(s) {
  // Aladhan returns "16:55", sometimes "16:55 (EET)"
  const clean = String(s).split(' ')[0];
  const [h, m] = clean.split(':').map(Number);
  return { h, m };
}

async function fetchTimings() {
  const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(CITY)}&country=${encodeURIComponent(COUNTRY)}&method=${METHOD}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Aladhan API failed: ${res.status}`);
  const json = await res.json();
  if (json.code !== 200 || !json.data?.timings) {
    throw new Error('Aladhan API returned unexpected data');
  }
  return json.data;
}

function targetTime(today, maghribHHMM, delayMinutes) {
  const { h, m } = parseHHMM(maghribHHMM);
  const t = new Date(today);
  t.setHours(h, m, 0, 0);
  t.setMinutes(t.getMinutes() + delayMinutes);
  return t;
}

async function getTodayPlan() {
  const prayer = process.env.PRAYER || 'Maghrib';
  const delay = Number(process.env.DELAY_MINUTES || 30);
  const windowMinutes = Number(process.env.WINDOW_MINUTES || 15);

  const data = await fetchTimings();
  const maghrib = data.timings[prayer];
  if (!maghrib) throw new Error(`Prayer ${prayer} not found in Aladhan response`);

  const now = cairoNow();
  const today = cairoTodayString(now);
  const target = targetTime(now, maghrib, delay);
  const windowEnd = new Date(target.getTime() + windowMinutes * 60 * 1000);

  return {
    today,
    prayer,
    maghrib,
    delayMinutes: delay,
    target,
    windowEnd,
    now,
    isInWindow: now >= target && now < windowEnd,
    hijri: data.date?.hijri?.date || '',
    gregorian: data.date?.gregorian?.date || today,
  };
}

module.exports = { cairoNow, cairoTodayString, fetchTimings, targetTime, getTodayPlan, parseHHMM };
