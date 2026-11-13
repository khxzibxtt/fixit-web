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

const logger = pino({ level: "silent" });

async function initWhatsAppSession(phoneNumber = null) {
  if (sock && (isConnected || isConnecting)) {
    if (phoneNumber && !isConnected && sock.requestPairingCode) {
      try {
        const cleanNumber = String(phoneNumber).replace(/\D/g, "");
        currentPairingCode = await sock.requestPairingCode(cleanNumber);
        boundPhoneNumber = cleanNumber;
        return { ok: true, pairingCode: currentPairingCode, status: "WAITING_CODE" };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }
    return { ok: true, status: isConnected ? "CONNECTED" : "CONNECTING", pairingCode: currentPairingCode };
  }

  isConnecting = true;
  connectionError = null;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

    sock = makeWASocket({
      version,
      logger,
      auth: state,
      printQRInTerminal: false,
      browser: ["FixIt Oman", "Chrome", "1.0.0"],
      syncFullHistory: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

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
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(`[WA-WEB] Connection closed (shouldReconnect=${shouldReconnect})`, lastDisconnect?.error);
        if (shouldReconnect) {
          setTimeout(() => initWhatsAppSession(), 5000);
        } else {
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            fs.mkdirSync(AUTH_DIR, { recursive: true });
          } catch (_) {}
          sock = null;
        }
      }
    });

    if (phoneNumber && !state.creds.registered) {
      const cleanNumber = String(phoneNumber).replace(/\D/g, "");
      boundPhoneNumber = cleanNumber;
      setTimeout(async () => {
        try {
          if (sock && sock.requestPairingCode) {
            currentPairingCode = await sock.requestPairingCode(cleanNumber);
            console.log(`[WA-WEB] Pairing code generated for ${cleanNumber}: ${currentPairingCode}`);
          }
        } catch (err) {
          console.error("[WA-WEB] Error requesting pairing code:", err);
          connectionError = err.message;
        }
      }, 3000);
    }

    return { ok: true, status: isConnected ? "CONNECTED" : "CONNECTING", pairingCode: currentPairingCode };
  } catch (err) {
    isConnecting = false;
    connectionError = err.message;
    console.error("[WA-WEB] Initialization failed:", err);
    return { ok: false, error: err.message };
  }
}

// Auto-boot existing session if auth credentials exist
try {
  const files = fs.readdirSync(AUTH_DIR);
  if (files && files.length > 0) {
    initWhatsAppSession();
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

async function requestPairing(phone) {
  const cleanNumber = String(phone).replace(/\D/g, "");
  if (!cleanNumber || cleanNumber.length < 8) {
    return { ok: false, error: "Invalid phone number format" };
  }
  return await initWhatsAppSession(cleanNumber);
}

async function sendWhatsAppMessage(toPhone, message) {
  if (!isConnected || !sock) {
    return { ok: false, error: "WhatsApp Web not connected. Please pair in Admin panel." };
  }

  try {
    let clean = String(toPhone).replace(/\D/g, "");
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
