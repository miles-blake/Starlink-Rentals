// Minimal service worker: satisfies the installable-PWA requirement and gives
// the admin app a registered worker to attach push handling to in a later phase.
// No caching strategy yet — nothing to cache until real routes exist.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
