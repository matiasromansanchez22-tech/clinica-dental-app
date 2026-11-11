// Service worker mínimo — no cachea nada (para que nunca se vea una
// versión vieja de la app). Solo existe porque algunos navegadores lo
// piden como requisito para poder "Instalar" la app.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Notificaciones push (avisos de error, etc.)
self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = {};
  }
  event.waitUntil(
    self.registration.showNotification(datos.title || "Clínica Dental", {
      body: datos.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: datos.url || "/" },
      // Avisos importantes (ej. pedido de turno de un paciente): quedan en pantalla hasta que se toquen, vibran y suenan de nuevo si llega otro.
      ...(datos.persistente ? { requireInteraction: true, vibrate: [300, 150, 300, 150, 300] } : {}),
      ...(datos.tag ? { tag: datos.tag, renotify: true } : {}),
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const cliente of lista) {
        if (cliente.url.includes(url) && "focus" in cliente) return cliente.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
