// Caption placeholders.
// {n}          = image number, e.g. 1
// {date}       = today in Cairo, YYYY-MM-DD
// {nextDay} / {nextDayAr} = tomorrow's day name in Arabic, e.g. الخميس
// {nextDayEn}  = tomorrow's day name in English, e.g. Thursday
// {tomorrow}   = tomorrow's date, YYYY-MM-DD
// {fridayLine} = Friday text if tomorrow is Friday, otherwise empty
//
// If the caption does NOT contain {fridayLine} and tomorrow IS Friday,
// FRIDAY_TEXT is added automatically as a new line at the end.
// Set FRIDAY_TEXT in .env. Default: جمعة مباركة 🌙
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseToday(today) {
  if (today instanceof Date) return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (typeof today === 'string' && /^\d{4}-\d{2}-\d{2}/.test(today)) {
    const [y, m, d] = today.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
}

function nextDayInfo(today) {
  const base = parseToday(today);
  const tomorrow = new Date(base);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getDate()).padStart(2, '0');
  const dayIndex = tomorrow.getDay(); // 0=Sunday ... 5=Friday ... 6=Saturday
  return {
    date: tomorrow,
    dateString: `${y}-${m}-${d}`,
    dayIndex,
    nameAr: AR_DAYS[dayIndex],
    nameEn: EN_DAYS[dayIndex],
    isFriday: dayIndex === 5,
  };
}

function fridayText() {
  return (process.env.FRIDAY_TEXT || 'جمعة مباركة 🌙').trim();
}

function formatCaption(raw, { imageNumber, today } = {}) {
  if (!raw) return '';
  const next = nextDayInfo(today);
  const friday = next.isFriday ? fridayText() : '';
  const todayStr = typeof today === 'string' ? today.slice(0, 10) : '';

  // .env files are single-line, so \n written there means a new line.
  let out = String(raw).replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')
    .replaceAll('{n}', String(imageNumber ?? ''))
    .replaceAll('{date}', todayStr)
    .replaceAll('{today}', todayStr)
    .replaceAll('{tomorrow}', next.dateString)
    .replaceAll('{tomorrowDate}', next.dateString)
    .replaceAll('{nextDayAr}', next.nameAr)
    .replaceAll('{nextDayEn}', next.nameEn)
    .replaceAll('{nextDay}', next.nameAr)
    .replaceAll('{tomorrowDay}', next.nameAr)
    .replaceAll('{fridayLine}', friday);

  // If the template did not place {fridayLine} itself, add the Friday line at the end.
  if (next.isFriday && friday && !String(raw).includes('{fridayLine}')) {
    out = `${out.replace(/\s+$/, '')}\n${friday}`;
  }
  // Clean up empty lines left by an empty {fridayLine} on non-Friday days.
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { AR_DAYS, EN_DAYS, nextDayInfo, fridayText, formatCaption };
