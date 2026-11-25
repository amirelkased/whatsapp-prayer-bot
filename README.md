# WhatsApp Prayer Bot — Maghrib +30m, Cairo

Sends **one image a day** to a WhatsApp group, **30 minutes after Maghrib in Cairo**.
Images are picked sequentially from GitHub (default) or Cloudinary: `1.jpg, 2.jpg … 999.jpg`, then back to `1.jpg`.

- Prayer time: Aladhan API, free, no key. Method 5 = Egyptian General Authority of Survey.
- Images: GitHub public repo by default, Supabase Storage, or Cloudinary if you set `IMAGE_SOURCE=supabase` / `cloudinary`. Named `1` to `999`.
- State: local `state.json` by default, or Supabase Postgres (`bot_state` table) if you set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — same state everywhere, no double-send.
- Text: per-image text in `captions.json`, otherwise `CAPTION_TEMPLATE` in `.env`.
- Sending: Baileys (WhatsApp Web library) to a group JID ending in `@g.us`.

## Important — WhatsApp groups are different from Telegram

The **official WhatsApp Business API does NOT support groups**. It only does 1-to-1 chats.
So there is no official, free, safe way to post to a WhatsApp group.

This bot uses **Baileys**, an unofficial library that logs in as a linked device
on your own WhatsApp account (like WhatsApp Web). That is the only free way,
but be honest about the trade-offs:

- WhatsApp can flag or ban accounts used for automation. Use a **secondary number** if you can.
- It only sends 1 message per day here, which is low risk, but the risk is not zero.
- Never use it for spam or bulk messages.
- If WhatsApp changes its Web protocol, Baileys can break until it is updated.

If you want zero ban risk, the alternative is Telegram (official bot API, free, no risk)
and post to WhatsApp manually — or use a WhatsApp Channel, which also has no group API.

## Setup — 10 minutes

### 1. Images — GitHub (default, no extra account)
1. Create a **public** GitHub repo, e.g. `quotes` (private will not work — WhatsApp cannot fetch the image).
2. Upload your quote images to a folder in it, e.g. `quotes/`.
3. Name them exactly `1.jpg`, `2.jpg`, `3.jpg` … up to `999.jpg`.
4. Keep each file under 100 MB (GitHub's per-file limit) — quote images are usually < 1 MB, so fine. Total repo: keep under 1 GB if you can.
5. The bot builds this URL:
   `https://raw.githubusercontent.com/<your-username>/quotes/main/quotes/1.jpg`

   In `.env`:
   ```
   IMAGE_SOURCE=github
   GITHUB_OWNER=your-github-username
   GITHUB_REPO=quotes
   GITHUB_BRANCH=main
   IMAGE_FOLDER=quotes
   ```

   Tip: you can put the images in the **same repo as this bot**, in a `quotes/` folder. Then `GITHUB_REPO` is that repo's name, and GitHub Actions already has the files.

   **GitHub vs Cloudinary:** GitHub is simpler and free, no extra account, and 1 image a day is well within its limits. Cloudinary is better if you later want automatic resizing / optimisation / a fast CDN. To switch, set `IMAGE_SOURCE=cloudinary` and `CLOUDINARY_CLOUD_NAME=...` in `.env` — same `1.jpg` … `999.jpg` naming, same folder.

### 2. Install
```bash
npm install
cp .env.example .env
# edit .env: GITHUB_OWNER, GITHUB_REPO, GROUP_JID
```

### 3. Log in to WhatsApp
```bash
npm run login
```
Scan the QR with WhatsApp > Linked devices > Link a device.
Or set `PHONE_NUMBER=20100...` in `.env` and it will print a pairing code instead.
Auth is saved in `./auth` — **never share or commit it**.

### 4. Find your group ID
```bash
npm run list-groups
```
Copy the JID for your group into `.env`:
```
GROUP_JID=120363123456789012@g.us
```

### 5. Test without sending
```bash
npm run dry-run
```
Today (25 Nov 2026) it should show: Maghrib 16:55, target 17:25, next image #1.

Test a real send right now (ignores the prayer time, still moves to the next number):
```bash
npm run send-now
# or a specific image:
node index.js --send-now --image=5
```

## How it runs for free — pick one

### Option A — Best: Oracle Cloud Always Free VPS (recommended)
Free forever, always on, session stays logged in.
1. Create an Oracle Cloud free account, launch an Always Free VM (Ampere / AMD, Ubuntu).
2. On the VM: `git clone` this repo, `npm install`, copy `.env` and `./auth` from your computer (or run `npm run login` on the VM).
3. Run it as a daemon that checks every minute:
   ```bash
   npm start
   # keep it alive after you log out:
   nohup npm start > bot.log 2>&1 &
   # or use pm2:  npm i -g pm2 && pm2 start index.js -- --daemon && pm2 save
   ```
4. It sends once per day at Maghrib+30m and records it in `state.json`, so it never double-sends.

### Option B — GitHub Actions (free, but less reliable for WhatsApp)
The workflow in `.github/workflows/check.yml` runs every 10 minutes and calls `node index.js --check`.
The script only sends inside the 15-minute window after Maghrib+30m, and only if it has not sent today.

To use it you must add these GitHub Secrets (Settings > Secrets and variables > Actions):
`GROUP_JID`, `SUPABASE_URL`, `SUPABASE_BUCKET` (= `QuranWerd`), `SUPABASE_SERVICE_ROLE_KEY`, `CAPTION_TEMPLATE`, `FRIDAY_TEXT`, and `AUTH_BASE64`.
The workflow already sets `IMAGE_SOURCE=supabase`, `IMAGE_FOLDER` empty (images in bucket root), `IMAGE_EXT=png`.

Make `AUTH_BASE64` after logging in locally:
```bash
tar czf - auth | base64 -w0
# paste that long string as the AUTH_BASE64 secret
```
Caveats: the session can expire, so use Option A if you want it to just work every day. State is in Supabase (`bot_state`), so it is shared — no double-send.

### Option C — Your own computer
Just leave `npm start` running. Works, but stops when the computer sleeps or restarts.

## Vercel + Supabase — what they help with, and what they don't

Good news: they make two parts much better. Bad news: they don't solve the WhatsApp part.

**Supabase — use it, it's a real upgrade:**
- **Storage instead of GitHub:** create a public bucket `quotes`, upload `1.jpg` … `999.jpg` into a `quotes/` folder. Free tier: 1 GB storage, 50 MB per file — plenty for 1 image a day. Set in `.env`:
  ```
  IMAGE_SOURCE=supabase
  SUPABASE_URL=https://your-project-ref.supabase.co
  SUPABASE_BUCKET=quotes
  ```
  URL becomes `https://your-project-ref.supabase.co/storage/v1/object/public/quotes/quotes/1.jpg`
- **Database instead of `state.json`:** run `supabase/schema.sql` once in Supabase > SQL Editor. It creates `bot_state` (last image + date) only — no captions table. Then set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env`. The bot reads/writes state there, so Vercel, GitHub Actions and a VPS all see the same counter — no restart to #1, no double-send.
- Caveat: free Supabase projects pause after 1 week of inactivity — with a daily send, yours stays active.

**Vercel — useful, but with a Hobby trap:**
- `api/check.js` is a status endpoint: `GET /api/check` returns JSON with `due`, `target`, `nextImage`, `imageUrl`, `caption`. Deploy this repo to Vercel, set the same env vars there, and you can check it from your phone. Optional `CRON_SECRET` protects it: `/api/check?secret=...`
- `vercel.json` has a cron at `0 15 * * *` (15:00 UTC = 17:00 Cairo). **On Hobby, Vercel Cron runs at most once per day, at any time inside that hour, in UTC only.** A more frequent schedule fails the deploy. So a Hobby cron can fire at 15:05 UTC (before Maghrib+30m at 15:25 UTC) or 15:50 UTC (after the 15-min window) — it cannot reliably hit 17:25 Cairo. The newer Vercel Schedules (beta, Nov 2026) can run every 15 min on Hobby, with a 15-min jitter and 5,000 runs/month — use that if it's available in your dashboard, instead of the legacy cron.
- **Vercel cannot be the WhatsApp sender.** Baileys needs a persistent WhatsApp Web connection, and a Vercel function lives at most 300 seconds on Hobby and has no persistent disk for the `./auth` session. Each run would have to reconnect, restore the session from Supabase, and hope it finishes in time. Possible, but fragile.

**Recommended setup if you have Vercel + Supabase:**
```
Supabase Storage (images) + Supabase DB (state only)
        ↓
Vercel /api/check (status + trigger, every 15 min via Schedules or cron-job.org)
        ↓
Always-on worker — Oracle Free VPS, or GitHub Actions — polls /api/check,
sends via Baileys when due=true, writes state back to Supabase
```
If you have no VPS: keep GitHub Actions (every 10 min, already in `.github/workflows/`) as the sender, and use Supabase only for images + state. That is free, and more reliable than Vercel-as-sender on Hobby.

## Captions — next day name + Friday line

Your caption is static text, with `{nextDayAr}` where you want tomorrow's day name.
In `.env` (one line, use `\n` for a new line):
```
CAPTION_TEMPLATE=تقبل الله منا ومنكم 🌙\nغداً {nextDayAr} بإذن الله
FRIDAY_TEXT=جمعة مباركة 🌙
```
- Today is Wednesday → `غداً الخميس بإذن الله`, no extra line.
- Today is Thursday → `غداً الجمعة بإذن الله` + a new line `جمعة مباركة 🌙`.
- Other placeholders: `{n}` image number, `{date}` today, `{tomorrow}` tomorrow's date, `{nextDayEn}` English day name, `{fridayLine}` to place the Friday line yourself instead of auto-adding it at the end.
- Same placeholders work in `captions.json` — a per-image caption wins over `CAPTION_TEMPLATE`.
- Precedence, in order: 1) `captions.json` for that image number, 2) `CAPTION_TEMPLATE`. `captions.json` is empty by default, so the template applies to all images. Dry-run now prints `Caption source: ...` so you can see which one was used.
- Editing `.env` while the daemon (`npm start`) is running now applies on the next check — the bot re-reads `.env` every minute, no restart needed.

## Troubleshooting

### "Waiting for this message" in WhatsApp
That is WhatsApp saying a phone could not decrypt the message and asked the sender to resend it. It is not a Supabase / image problem — the image URL is fine if it opens in a browser.
1. First wait: open WhatsApp on the sender phone, keep it online, open the group, wait 2-3 minutes. Often it clears by itself.
2. Check who sees it: if only one member sees it, it's that phone's sync, not the bot.
3. If it stays for everyone after 10+ minutes: the Baileys session keys are stale (WhatsApp's newer LID system, Baileys 6). Fix:
   ```
   npm install
   ```
   This bot now uses Baileys 7.0.0-rc14 with a `getMessage` retry store, so WhatsApp can ask the bot to resend and the message can decrypt.
   Then delete the old login and log in fresh:
   ```
   # Windows PowerShell: Remove-Item -Recurse -Force auth
   # Mac/Linux: rm -rf auth
   npm run login
   ```
   Scan the QR again, then test with `npm run send-now` (remember: that sends image #1 and advances the counter — reset `bot_state` in Supabase to 0 / null afterwards if you want tomorrow to be #1 again).
4. If it still happens for media only, try a text-only test first. If text works and image doesn't, the image file may be too large or in a format WhatsApp can't preview — keep images under 5 MB, JPG/PNG.

## How the timing works

Every check:
1. Fetch today's Maghrib for Cairo from Aladhan.
2. Target = Maghrib + 30 minutes. Today: 16:55 + 30m = **17:25**.
3. If now is in `[17:25, 17:40)` and `state.json` says nothing was sent today, send the next image.
4. After a successful send, save `lastIndex` and `lastSentDate` in `state.json`.
   Next day it sends the next number. After 999 it wraps to 1.

## Files

| File | What it does |
|---|---|
| `index.js` | Entry point: `--check`, `--dry-run`, `--daemon`, `--send-now` |
| `lib/prayer.js` | Aladhan fetch, Cairo time, Maghrib+30m window |
| `lib/state.js` | Sequential 1–999 circular counter + last-sent date |
| `lib/images.js` | Builds the image URL (GitHub raw URL by default, Supabase Storage, or Cloudinary) + caption for an image number |
| `lib/state-store.js` | State: Supabase Postgres if configured, else local `state.json` |
| `supabase/schema.sql` | SQL to create `bot_state` table in Supabase (and drop the old `captions` table if you made one) |
| `api/check.js` | Vercel endpoint `GET /api/check` — status JSON, does not send to WhatsApp |
| `vercel.json` | Vercel Cron (Hobby: once a day, see Vercel + Supabase section) |
| `lib/whatsapp.js` | Baileys login (QR / pairing code) + send image to group |
| `captions.json` | Optional text per image number, e.g. `{"1": "...", "2": "..."}` |
| `state.json` | Last image sent + date. Do not edit by hand unless testing. |
| `scripts/login.js` | First login |
| `scripts/list-groups.js` | List groups + JIDs |

## Changing it later

- Different delay: `DELAY_MINUTES=15` in `.env`
- Different prayer: `PRAYER=Isha` in `.env`
- Switch image host: `IMAGE_SOURCE=github` or `IMAGE_SOURCE=cloudinary` in `.env`
- Different text: edit `captions.json` or `CAPTION_TEMPLATE`
- Restart the counter: set `lastIndex` in `state.json` to e.g. `42` and it will send 43 next.
