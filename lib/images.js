// Image source: GitHub (default), Supabase Storage, or Cloudinary.
// No API key needed for the URL itself — all three build a public URL from the image number.
// Images are named 1.jpg, 2.jpg ... 999.jpg, picked sequentially and circularly.

function imageUrl(imageNumber) {
  const source = (process.env.IMAGE_SOURCE || 'github').toLowerCase();
  const ext = process.env.IMAGE_EXT || 'jpg';
  // IMAGE_FOLDER can be empty (= images are in the bucket/repo root).
  // Use ?? so an empty IMAGE_FOLDER= in .env is honoured, not replaced by 'quotes'.
  const folderRaw = process.env.IMAGE_FOLDER ?? process.env.CLOUDINARY_FOLDER ?? 'quotes';
  const folder = String(folderRaw).replace(/^\/|\/$/g, '').replace(/^\.$/, '');
  const filePath = folder ? `${folder}/${imageNumber}.${ext}` : `${imageNumber}.${ext}`;

  if (source === 'supabase') {
    const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const bucket = process.env.SUPABASE_BUCKET || 'quotes';
    if (!url) throw new Error('SUPABASE_URL is missing in .env. Example: SUPABASE_URL=https://xyzcompany.supabase.co');
    // Public bucket. Example with folder: .../public/quotes/quotes/1.jpg
    // Example in bucket root (IMAGE_FOLDER empty): .../public/quotes/1.jpg
    return `${url}/storage/v1/object/public/${bucket}/${filePath}`;
  }

  if (source === 'github') {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    if (!owner || !repo) {
      throw new Error('GITHUB_OWNER and GITHUB_REPO are missing in .env. Example: GITHUB_OWNER=amirelkased, GITHUB_REPO=quotes');
    }
    // Public repo, raw file URL. Works for Baileys image: { url: ... }
    // Example: https://raw.githubusercontent.com/amirelkased/quotes/main/quotes/1.jpg
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  }

  if (source === 'cloudinary') {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    if (!cloud) throw new Error('CLOUDINARY_CLOUD_NAME is missing in .env');
    return `https://res.cloudinary.com/${cloud}/image/upload/${filePath}`;
  }

  throw new Error(`Unknown IMAGE_SOURCE: ${source}. Use github, supabase, or cloudinary.`);
}

const { formatCaption } = require('./caption');
const fs = require('fs');
const path = require('path');

// Where the last caption came from, for the dry-run log.
// Precedence: 1) captions.json  2) CAPTION_TEMPLATE (.env)
// No Supabase captions table.
let lastCaptionSource = 'CAPTION_TEMPLATE';
function getLastCaptionSource() { return lastCaptionSource; }

function readLocalCaptions() {
  // Read from disk every time (not require(), which caches),
  // so editing captions.json while the daemon runs applies on the next check.
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'captions.json'), 'utf8'));
  } catch { return {}; }
}

function captionFor(imageNumber, today) {
  // Optional per-image text in captions.json, e.g. { "1": "text...", "2": "..." }
  // If there is no entry for this image, CAPTION_TEMPLATE is used.
  const captions = readLocalCaptions();
  if (captions[String(imageNumber)]) {
    lastCaptionSource = `captions.json #${imageNumber}`;
    return formatCaption(captions[String(imageNumber)], { imageNumber, today });
  }
  lastCaptionSource = 'CAPTION_TEMPLATE (.env)';
  const raw = process.env.CAPTION_TEMPLATE || '';
  return formatCaption(raw, { imageNumber, today });
}

async function captionForAsync(imageNumber, today) {
  // No Supabase captions table — Amir doesn't need it.
  // Caption comes only from captions.json (if an entry exists for this
  // image) or from CAPTION_TEMPLATE in .env. Supabase is used only for
  // images (Storage) and for state (bot_state table).
  return captionFor(imageNumber, today);
}

module.exports = { imageUrl, captionFor, captionForAsync, getLastCaptionSource };
