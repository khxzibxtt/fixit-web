const path = require("path");
const fs = require("fs");
const pino = require("pino");
const QRCode = require("qrcode");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const { isConfigured: isSupabaseConfigured, supabaseRequest } = require("./supabase");

const AUTH_DIR = path.join(__dirname, "../../.wa_auth");
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "b3264964-ab0e-4638-8514-62de24ba511f";

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

let sock = null;
let isConnected = false;
let isConnecting = false;
let currentQr = null;
let currentQrDataUrl = null;
let currentPairingCode = null;
let connectionError = null;
let boundPhoneNumber = null;
let meInfo = null;
let reconnectTimer = null;
let startPromise = null;
let backupTimer = null;
let sessionNonce = 0;

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

function closeExistingSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sock) {
    try {
      sock.ev.removeAllListeners("connection.update");
      sock.ev.removeAllListeners("creds.update");
      if (sock.ws && typeof sock.ws.close === "function") sock.ws.close();
    } catch (_) {}
  }
  sock = null;
  isConnected = false;
  isConnecting = false;
}

async function backupAuthToSupabase(clearBundle = false) {
  if (!isSupabaseConfigured()) return;
  try {
    const q = await supabaseRequest(`/user_settings?user_id=eq.${encodeURIComponent(ADMIN_USER_ID)}&limit=1`);
    const existing = (q.ok && Array.isArray(q.data) && q.data[0] && q.data[0].settings) || {};
    const nextSettings = { ...(typeof existing === "object" && existing ? existing : {}) };

    if (clearBundle) {
      delete nextSettings.wa_auth_bundle;
    } else {
      if (!fs.existsSync(AUTH_DIR)) return;
      const files = {};
      for (const fname of fs.readdirSync(AUTH_DIR)) {
        if (!fname.endsWith(".json")) continue;
        try {
          files[fname] = fs.readFileSync(path.join(AUTH_DIR, fname), "utf8");
        } catch (_) {}
      }
      if (!files["creds.json"]) return;
      nextSettings.wa_auth_bundle = {
        updatedAt: new Date().toISOString(),
        files
      };
    }

    await supabaseRequest("/user_settings", "POST", {
      user_id: ADMIN_USER_ID,
      settings: nextSettings,
      updated_at: new Date().toISOString()
    }, { Prefer: "resolution=merge-duplicates,return=minimal" });
  } catch (err) {
    console.error("[WA-WEB] Failed to sync auth bundle to Supabase:", err && err.message ? err.message : err);
  }
}

function scheduleSupabaseBackup() {
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    backupAuthToSupabase(false);
  }, 1200);
}

async function restoreAuthFromSupabase() {
  if (!isSupabaseConfigured()) return false;
  try {
    const q = await supabaseRequest(`/user_settings?user_id=eq.${encodeURIComponent(ADMIN_USER_ID)}&limit=1`);
    const settings = q.ok && Array.isArray(q.data) && q.data[0] ? q.data[0].settings : null;
    const bundle = settings && settings.wa_auth_bundle && settings.wa_auth_bundle.files;
    if (!bundle || !bundle["creds.json"]) return false;
    resetAuthDir();
    for (const [fname, raw] of Object.entries(bundle)) {
      if (!fname.endsWith(".json") || typeof raw !== "string") continue;
      const safeName = path.basename(fname);
      fs.writeFileSync(path.join(AUTH_DIR, safeName), raw, "utf8");
    }
    console.log("[WA-WEB] Restored WhatsApp session files from permanent Supabase backup");
    return true;
  } catch (err) {
    console.error("[WA-WEB] Failed restoring auth bundle:", err && err.message ? err.message : err);
    return false;
  }
}

async function startSocket({ mode = "qr", phoneNumber = null, reset = false } = {}) {
  if (startPromise) {
    try { await startPromise; } catch (_) {}
  }

  let runFn = async () => {
    const myNonce = ++sessionNonce;
    const cleanPhone = phoneNumber ? normalizeWaPhone(phoneNumber) : null;

    if (reset || (mode === "pair" && !isConnected)) {
      closeExistingSocket();
      currentQr = null;
      currentQrDataUrl = null;
      currentPairingCode = null;
      if (reset) {
        resetAuthDir();
        await backupAuthToSupabase(true);
      }
    }

    if (sock && isConnected) {
      return { ok: true, isConnected: true, status: "CONNECTED", me: meInfo };
    }

    if (sock && isConnecting && mode === "qr" && currentQrDataUrl) {
      return {
        ok: true,
        isConnected: false,
        isConnecting: true,
        qrDataUrl: currentQrDataUrl,
        qr: currentQr,
        status: "WAITING_QR"
      };
    }

    if (sock && isConnecting && mode === "qr" && !reset) {
      const waitEnd = Date.now() + 8000;
      while (Date.now() < waitEnd && !currentQrDataUrl && !isConnected && isConnecting) {
        await new Promise(r => setTimeout(r, 400));
      }
      if (currentQrDataUrl || isConnected) {
        return {
          ok: true,
          isConnected,
          isConnecting,
          qrDataUrl: currentQrDataUrl,
          qr: currentQr,
          status: isConnected ? "CONNECTED" : "WAITING_QR",
          me: meInfo
        };
      }
    }

    closeExistingSocket();
    isConnecting = true;
    connectionError = null;
    currentQr = null;
    currentQrDataUrl = null;
    currentPairingCode = null;

    let { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    if ((mode === "qr" || mode === "pair") && state.creds && state.creds.registered && reset) {
      resetAuthDir();
      ({ state, saveCreds } = await useMultiFileAuthState(AUTH_DIR));
    }

    if (mode === "auto" && (!state.creds || !state.creds.registered)) {
      isConnecting = false;
      return { ok: true, isConnected: false, isConnecting: false, status: "NOT_LINKED" };
    }

    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1025190524] }));

    let resolveHandshakeReady;
    const handshakeReadyPromise = new Promise(resolve => {
      resolveHandshakeReady = resolve;
    });
    let handshakeResolved = false;
    const markHandshakeReady = () => {
      if (!handshakeResolved) {
        handshakeResolved = true;
        resolveHandshakeReady();
      }
    };

    sock = makeWASocket({
      version,
      logger,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu("Chrome"),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 30000
    });

    const activeSock = sock;

    activeSock.ev.on("creds.update", async () => {
      try {
        await saveCreds();
        if (activeSock.authState?.creds?.registered) {
          scheduleSupabaseBackup();
        }
      } catch (_) {}
    });

    activeSock.ev.on("connection.update", async (update) => {
      if (myNonce !== sessionNonce) return;
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQr = qr;
        markHandshakeReady();
        try {
          currentQrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
        } catch (qErr) {
          console.error("[WA-WEB] QR encode error:", qErr);
        }
      }

      if (connection === "open") {
        isConnected = true;
        isConnecting = false;
        currentQr = null;
        currentQrDataUrl = null;
        currentPairingCode = null;
        connectionError = null;
        meInfo = activeSock.user || activeSock.authState?.creds?.me || null;
        if (meInfo && meInfo.id) {
          boundPhoneNumber = String(meInfo.id).split(":")[0].split("@")[0];
        }
        markHandshakeReady();
        console.log(`[WA-WEB] WhatsApp connected successfully (${boundPhoneNumber || "linked"})!`);
        scheduleSupabaseBackup();
      }

      if (connection === "close") {
        isConnected = false;
        isConnecting = false;
        markHandshakeReady();
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const msg = lastDisconnect?.error?.message || "";
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const hasRegisteredCreds = Boolean(state.creds && state.creds.registered);
        const needsPostPairRestart = statusCode === DisconnectReason.restartRequired || statusCode === 515;

        console.log(`[WA-WEB] Connection closed (code=${statusCode}, registered=${hasRegisteredCreds}, restart=${needsPostPairRestart})`);

        if (isLoggedOut) {
          connectionError = "WhatsApp session logged out. Scan QR or pair again.";
          currentQr = null;
          currentQrDataUrl = null;
          currentPairingCode = null;
          resetAuthDir();
          await backupAuthToSupabase(true);
          sock = null;
          return;
        }

        if (hasRegisteredCreds || needsPostPairRestart) {
          reconnectTimer = setTimeout(() => {
            startSocket({ mode: "auto", reset: false }).catch(() => {});
          }, 1500);
        } else if (statusCode) {
          connectionError = msg || `Connection closed (${statusCode})`;
        }
      }
    });

    if (mode === "pair" && cleanPhone) {
      boundPhoneNumber = cleanPhone;
      // Wait for Baileys WebSocket handshake / initial pair-device frame BEFORE requesting pairing code once
      await Promise.race([
        handshakeReadyPromise,
        new Promise(r => setTimeout(r, 7000))
      ]);
      if (myNonce === sessionNonce && sock === activeSock && !isConnected && !state.creds.registered) {
        try {
          const rawCode = await activeSock.requestPairingCode(cleanPhone);
          if (rawCode) {
            currentPairingCode = String(rawCode).trim();
            connectionError = null;
            console.log(`[WA-WEB] Pairing code generated for ${cleanPhone}: ${currentPairingCode}`);
            return {
              ok: true,
              isConnected: false,
              isConnecting: true,
              pairingCode: currentPairingCode,
              qrDataUrl: currentQrDataUrl,
              phone: cleanPhone,
              status: "WAITING_CODE"
            };
          }
        } catch (err) {
          connectionError = (err && err.message) || "Failed to generate pairing code";
          console.error("[WA-WEB] requestPairingCode error:", connectionError);
          return {
            ok: false,
            error: connectionError,
            qrDataUrl: currentQrDataUrl
          };
        }
      }
    }

    // Wait up to 10s for first QR or Open when in QR mode
    if (mode === "qr") {
      const waitEnd = Date.now() + 10000;
      while (Date.now() < waitEnd && myNonce === sessionNonce && !currentQrDataUrl && !isConnected && isConnecting) {
        await new Promise(r => setTimeout(r, 350));
      }
    }

    return {
      ok: Boolean(isConnected || currentQrDataUrl || currentPairingCode || isConnecting),
      isConnected,
      isConnecting,
      qrDataUrl: currentQrDataUrl,
      qr: currentQr,
      pairingCode: currentPairingCode,
      phone: boundPhoneNumber,
      me: meInfo,
      error: (!currentQrDataUrl && !isConnected && connectionError) ? connectionError : null,
      status: isConnected
        ? "CONNECTED"
        : currentQrDataUrl
          ? "WAITING_QR"
          : currentPairingCode
            ? "WAITING_CODE"
            : (isConnecting ? "CONNECTING" : "IDLE")
    };
  };

  startPromise = runFn().finally(() => {
    startPromise = null;
  });
  return startPromise;
}

// Auto-boot on server start from local disk or Supabase backup
(async function bootWhatsApp() {
  try {
    const credsPath = path.join(AUTH_DIR, "creds.json");
    let hasCreds = fs.existsSync(credsPath);
    if (!hasCreds) {
      hasCreds = await restoreAuthFromSupabase();
    }
    if (hasCreds) {
      const raw = JSON.parse(fs.readFileSync(credsPath, "utf8"));
      if (raw && raw.registered) {
        await startSocket({ mode: "auto", reset: false });
      }
    }
  } catch (_) {}
})();

async function getWhatsAppStatus() {
  return {
    ok: true,
    isConnected,
    isConnecting,
    qrDataUrl: currentQrDataUrl,
    pairingCode: currentPairingCode,
    phone: boundPhoneNumber,
    me: meInfo,
    error: connectionError
  };
}

async function requestQrSession(opts = {}) {
  return await startSocket({ mode: "qr", reset: Boolean(opts.reset) });
}

async function requestPairing(phone, opts = {}) {
  const cleanNumber = normalizeWaPhone(phone);
  if (!cleanNumber || cleanNumber.length < 10) {
    return { ok: false, error: "Enter full phone number with country code (e.g. +96877956361)" };
  }
  return await startSocket({ mode: "pair", phoneNumber: cleanNumber, reset: Boolean(opts.reset) });
}

async function disconnectWhatsApp() {
  sessionNonce++;
  try {
    if (sock && typeof sock.logout === "function" && isConnected) {
      await sock.logout().catch(() => {});
    }
  } catch (_) {}
  closeExistingSocket();
  currentQr = null;
  currentQrDataUrl = null;
  currentPairingCode = null;
  boundPhoneNumber = null;
  meInfo = null;
  connectionError = null;
  resetAuthDir();
  await backupAuthToSupabase(true);
  return { ok: true, isConnected: false };
}

async function sendWhatsAppMessage(toPhone, message) {
  if (!isConnected || !sock) {
    return { ok: false, error: "WhatsApp Web not connected. Link via QR or code in Admin first." };
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
  requestQrSession,
  requestPairing,
  disconnectWhatsApp,
  sendWhatsAppMessage,
  isWhatsAppConnected: () => isConnected
};
