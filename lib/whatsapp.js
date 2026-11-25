// Baileys = unofficial WhatsApp Web library.
// It logs in as a linked device on YOUR WhatsApp account (QR or pairing code).
// Official WhatsApp Business API does NOT support sending to groups,
// so this is the only free way to post to a WhatsApp group automatically.
// Risk: WhatsApp can flag / ban automation. Use a secondary number if you can,
// send only 1 message per day (this bot does), and never use it for spam.
//
// NOTE on "Waiting for this message": that is WhatsApp saying a device
// could not decrypt a message and asked the sender to resend it.
// Baileys 6 had no getMessage handler by default, so there was nothing
// to resend and recipients stayed stuck. Baileys 7 + the getMessage
// store below fix that retry path. If you still see it, delete ./auth
// and run npm run login again to get fresh session keys.
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

// In-memory store for WhatsApp's decrypt-retry protocol.
// When a recipient can't decrypt a message, WhatsApp asks the sender
// (via getMessage) to send the original content again. Without this,
// the recipient stays on "Waiting for this message" forever.
const messageStore = new Map();
function storeMessage(msg) {
  if (msg?.key?.id && msg.message) {
    messageStore.set(msg.key.id, msg.message);
    if (messageStore.size > 100) {
      const first = messageStore.keys().next().value;
      messageStore.delete(first);
    }
  }
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();
  const logger = pino({ level: 'silent' });

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    printQRInTerminal: false,
    // Required for the retry protocol — see messageStore above.
    getMessage: async (key) => messageStore.get(key.id),
  });

  sock.ev.on('creds.update', saveCreds);
  // Remember incoming messages too, so they can be resent on retry.
  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const m of messages) storeMessage(m);
  });

  // Pairing code login (no QR scan) if PHONE_NUMBER is set and not registered yet
  if (process.env.PHONE_NUMBER && !sock.authState.creds.registered) {
    // wait a moment for socket to be ready
    await new Promise(r => setTimeout(r, 3000));
    try {
      const code = await sock.requestPairingCode(process.env.PHONE_NUMBER);
      console.log('\nPairing code (enter it in WhatsApp > Linked devices > Link with phone number instead):');
      console.log(code, '\n');
    } catch (e) {
      console.log('Pairing code failed, falling back to QR:', e.message);
    }
  }

  const connected = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for WhatsApp connection (60s). Scan the QR / enter the pairing code and try again.')), 60000);
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        console.log('\nScan this QR with WhatsApp > Linked devices > Link a device:\n');
        qrcode.generate(qr, { small: true });
      }
      if (connection === 'open') {
        clearTimeout(timeout);
        resolve(true);
      }
      if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        if (reason === DisconnectReason.loggedOut) {
          clearTimeout(timeout);
          reject(new Error('Logged out of WhatsApp. Delete ./auth and run npm run login again.'));
        }
      }
    });
  });

  if (!connected) throw new Error('Could not connect to WhatsApp');
  console.log('WhatsApp connected.');
  return sock;
}

async function sendImageToGroup(sock, groupJid, imageUrl, caption) {
  if (!groupJid || !groupJid.endsWith('@g.us')) {
    throw new Error(`GROUP_JID looks wrong: ${groupJid}. It must end with @g.us — run: npm run list-groups`);
  }
  // Baileys accepts a remote URL directly for image.
  // Downloading first and sending bytes is more reliable for some
  // groups / phones than a remote URL, so fetch it here.
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Could not download image: ${imageUrl} (HTTP ${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const sent = await sock.sendMessage(groupJid, { image: buffer, caption });
  storeMessage(sent);
  console.log(`Sent to ${groupJid}: ${imageUrl}`);
}

module.exports = { connect, sendImageToGroup };
