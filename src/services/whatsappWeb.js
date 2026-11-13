const path = require("path");
const fs = require("fs");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const AUTH_DIR = path.join(__dirname, "../../.wa_auth");
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

let sock = null;
let isConnected = false;
let isConnecting = false;
let currentPairingCode = null;
let connectionError = null;
let boundPhoneNumber = null;
let reconnectTimer = null;

const logger = pino({ level: "silent" });

function normalizeWaPhone(rawPhone) {
  let clean = String(rawPhone || "").replace(/\D/g, "");
  if (/^[79]\d{7}$/.test(clean)) {
    clean = "968" + clean;
  }
  return clean;
}

function resetAuthDir() {
  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  } catch (_) {}
}

async function requestCodeFromSocket(cleanNumber, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (isConnected) {
      return { ok: true, status: "CONNECTED", pairingCode: null, phone: boundPhoneNumber };
    }
    if (sock && typeof sock.requestPairingCode === "function") {
      try {
        const code = await sock.requestPairingCode(cleanNumber);
        if (code) {
          currentPairingCode = String(code).trim();
          boundPhoneNumber = cleanNumber;
          connectionError = null;
          console.log(`[WA-WEB] Pairing code generated for ${cleanNumber}: ${currentPairingCode}`);
          return {
            ok: true,
            pairingCode: currentPairingCode,
            status: "WAITING_CODE",
            phone: cleanNumber
          };
        }
      } catch (err) {
        const msg = String((err && err.message) || err || "");
        if (!/not open|connecting|wait|stream|connection/i.test(msg)) {
          connectionError = msg;
        }
      }
    }
    await new Promise(r => setTimeout(r, 800));
  }
  return {
    ok: Boolean(currentPairingCode),
    status: currentPairingCode ? "WAITING_CODE" : (isConnecting ? "CONNECTING" : "ERROR"),
    pairingCode: currentPairingCode,
    phone: boundPhoneNumber,
    error: currentPairingCode ? null : (connectionError || "Timed out waiting for WhatsApp pairing code. Tap Get Code again.")
  };
}

async function initWhatsAppSession(phoneNumber = null, forceReset = false) {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (forceReset || (phoneNumber && !isConnected && sock)) {
    try {
      if (sock && sock.ws && typeof sock.ws.close === "function") sock.ws.close();
    } catch (_) {}
    sock = null;
    isConnected = false;
    isConnecting = false;
    currentPairingCode = null;
  }

  if (sock && isConnected) {
    return { ok: true, status: "CONNECTED", pairingCode: null, phone: boundPhoneNumber };
  }

  isConnecting = true;
  connectionError = null;

  try {
    if (forceReset) {
      resetAuthDir();
    }
    let { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    if (phoneNumber && state.creds && state.creds.registered) {
      resetAuthDir();
      ({ state, saveCreds } = await useMultiFileAuthState(AUTH_DIR));
    }

    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

    sock = makeWASocket({
      version,
      logger,
      auth: state,
      printQRInTerminal: false,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      syncFullHistory: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "open") {
        isConnected = true;
        isConnecting = false;
        currentPairingCode = null;
        connectionError = null;
        console.log("[WA-WEB] WhatsApp connected successfully as primary sender!");
      }

      if (connection === "close") {
        isConnected = false;
        isConnecting = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = code !== DisconnectReason.loggedOut;
        connectionError = lastDisconnect?.error?.message || null;
        console.log(`[WA-WEB] Connection closed (code=${code}, shouldReconnect=${shouldReconnect})`);
        if (shouldReconnect && state.creds && state.creds.registered) {
          reconnectTimer = setTimeout(() => initWhatsAppSession(), 5000);
        } else if (!shouldReconnect) {
          resetAuthDir();
          sock = null;
        }
      }
    });

    if (phoneNumber) {
      const cleanNumber = normalizeWaPhone(phoneNumber);
      boundPhoneNumber = cleanNumber;
      return await requestCodeFromSocket(cleanNumber, 10000);
    }

    return { ok: true, status: isConnected ? "CONNECTED" : "CONNECTING", pairingCode: currentPairingCode };
  } catch (err) {
    isConnecting = false;
    connectionError = err.message;
    console.error("[WA-WEB] Initialization failed:", err);
    return { ok: false, error: err.message };
  }
}

// Auto-boot existing session ONLY if already registered
try {
  const credsPath = path.join(AUTH_DIR, "creds.json");
  if (fs.existsSync(credsPath)) {
    const raw = JSON.parse(fs.readFileSync(credsPath, "utf8"));
    if (raw && raw.registered) {
      initWhatsAppSession();
    }
  }
} catch (_) {}

async function getWhatsAppStatus() {
  return {
    ok: true,
    isConnected,
    isConnecting,
    pairingCode: currentPairingCode,
    phone: boundPhoneNumber,
    error: connectionError
  };
}

async function requestPairing(phone, opts = {}) {
  const cleanNumber = normalizeWaPhone(phone);
  if (!cleanNumber || cleanNumber.length < 10) {
    return { ok: false, error: "Enter full phone number with country code (e.g. +96877956361)" };
  }
  return await initWhatsAppSession(cleanNumber, Boolean(opts.reset));
}

async function sendWhatsAppMessage(toPhone, message) {
  if (!isConnected || !sock) {
    return { ok: false, error: "WhatsApp Web not connected. Please pair in Admin panel." };
  }

  try {
    let clean = normalizeWaPhone(toPhone);
    if (!clean.endsWith("@s.whatsapp.net")) {
      clean = `${clean}@s.whatsapp.net`;
    }

    const sent = await sock.sendMessage(clean, { text: message });
    return { ok: true, id: sent?.key?.id, status: "SENT" };
  } catch (err) {
    console.error("[WA-WEB] Send message failed:", err);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  getWhatsAppStatus,
  requestPairing,
  sendWhatsAppMessage,
  isWhatsAppConnected: () => isConnected
};
