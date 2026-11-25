const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'state.json');
const MAX = Number(process.env.MAX_IMAGES || 999);

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { lastIndex: 0, lastSentDate: null, lastSentImage: null };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Sequential, circular: 1, 2, 3 ... 999, 1, 2 ...
function nextIndex(state) {
  const last = Number(state.lastIndex || 0);
  return (last % MAX) + 1;
}

function markSent(state, imageNumber, today) {
  const next = { ...state, lastIndex: imageNumber, lastSentDate: today, lastSentImage: imageNumber };
  saveState(next);
  return next;
}

module.exports = { loadState, saveState, nextIndex, markSent, STATE_FILE };
