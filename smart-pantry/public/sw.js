// Minimal service worker: makes the app installable on Android and shows an offline page.
// Data is always fetched live (network-first) – inventory must never come from a stale cache.
const SHELL = "pantry-shell-v2";
const SHARED = "pantry-shared";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/offline.html", "/icon.svg"])));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Android "Share → Smart Pantry": stash the photos, then open the add sheet.
  if (e.request.method === "POST" && url.pathname === "/share-target") {
    e.respondWith((async () => {
      const form = await e.request.formData();
      const cache = await caches.open(SHARED);
      await Promise.all((await cache.keys()).map((k) => cache.delete(k)));
      const files = form.getAll("photos").filter((f) => f && typeof f !== "string");
      await Promise.all(files.map((f, i) => cache.put(`/shared/${i}`, new Response(f, { headers: { "Content-Type": f.type, "X-Name": encodeURIComponent(f.name || `photo-${i}.jpg`) } }))));
      return Response.redirect(`/inventory?shared=${files.length}`, 303);
    })());
    return;
  }
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/offline.html")));
  }
});
