// Service worker mínimo — no cachea nada (para que nunca se vea una
// versión vieja de la app). Solo existe porque algunos navegadores lo
// piden como requisito para poder "Instalar" la app.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
