// Service Worker — Werewolf Party: Village of Secrets
// ทำให้เล่นออฟไลน์ได้ (offline-capable PWA) สำหรับ Play Store (TWA) และการติดตั้งบนมือถือ
//
// วิธีอัปเดตแคชเมื่อมีเนื้อหาใหม่:
//   บั๊มเลข CACHE_NAME (เช่น 'wwp-cache-v1' -> 'wwp-cache-v2') ทุกครั้งที่ต้องการบังคับให้ผู้เล่น
//   ได้ไฟล์เกมเวอร์ชันล่าสุดตอนออฟไลน์ (ไม่จำเป็นต้องบั๊มทุกครั้งที่ bump verbadge — ตอนออนไลน์
//   ระบบจะดึงไฟล์ล่าสุดจากเน็ตเวิร์กอยู่แล้วผ่านกลยุทธ์ network-first ด้านล่าง)
const CACHE_NAME = 'wwp-cache-v1';

// ไฟล์ core ที่ต้องแคชไว้ให้เล่นออฟไลน์ได้ — ใช้ชื่อไฟล์ "คงที่" (werewolf-v3_0_0.html) ที่ชี้ไปยัง
// เวอร์ชันล่าสุดเสมอ ไม่ต้องแก้ไฟล์นี้ทุกครั้งที่ bump verbadge ของเกม
const APP_SHELL = [
  './werewolf-v3_0_0.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.warn('[sw] app shell cache failed (non-fatal):', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // ไม่ยุ่งกับ POST/อื่นๆ
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ไม่แคช cross-origin

  // หน้าเกม (navigation) — network-first: ออนไลน์ได้เวอร์ชันล่าสุดเสมอ, ออฟไลน์ใช้แคชล่าสุดที่มี
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./werewolf-v3_0_0.html', copy));
          return res;
        })
        .catch(() => caches.match('./werewolf-v3_0_0.html'))
    );
    return;
  }

  // ไฟล์ static อื่นๆ (icons/manifest) — cache-first, อัปเดตเงียบๆ ในพื้นหลัง
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
