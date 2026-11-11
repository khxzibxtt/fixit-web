/* FixIt Progressive Web App (PWA) Offline Service Worker */
const CACHE_NAME = "fixit-cache-v14";
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/logo.png",
  "/qrcode.js",
  "/fonts/TTCommonsPro-Normal.otf",
  "/fonts/TTCommonsPro-Bold.otf",
  "/fonts/NotoSansArabic-Regular.otf",
  "/fonts/NotoSansArabic-Bold.otf",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn("Pre-cache asset warning:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET requests or chrome extension calls
  if (req.method !== "GET" || url.protocol.startsWith("chrome")) {
    return;
  }

  // API calls: Network-first with cache fallback
  if (url.pathname.startsWith("/api/") || url.hostname.includes("supabase.co") || url.hostname.includes("paypal.com") || url.hostname.includes("twilio.com")) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Static assets: Cache-first with network refresh
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        fetch(req).then(netResp => {
          if (netResp && netResp.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(req, netResp));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then(netResp => {
        if (netResp && netResp.status === 200) {
          const clone = netResp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return netResp;
      }).catch(() => {
        if (req.mode === "navigate") {
          return caches.match("/index.html");
        }
      });
    })
  );
});
