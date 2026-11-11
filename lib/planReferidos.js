// Dirección pública del plan de referidos (la que abre el QR del cartel). Si algún día cambia el dominio de la
// aplicación, se cambia acá y se vuelve a imprimir el cartel.
export const URL_PLAN_REFERIDOS = "https://clinica-dental-app-gamma.vercel.app/referidos";

// Link del plan para un lugar puntual (cada cartel con QR lleva el suyo, así se sabe de cuál vienen los escaneos).
export const urlPlanReferidos = (lugar) => (lugar && lugar !== "general" ? `${URL_PLAN_REFERIDOS}?lugar=${lugar}` : URL_PLAN_REFERIDOS);

// Dirección pública de la página de consultas de ortodoncia (información, valores y botón de WhatsApp). Cada cartel lleva su lugar.
export const URL_ORTODONCIA_INFO = "https://clinica-dental-app-gamma.vercel.app/ortodoncia-info";
export const urlOrtodonciaInfo = (lugar) => (lugar && lugar !== "general" ? `${URL_ORTODONCIA_INFO}?lugar=${lugar}` : URL_ORTODONCIA_INFO);

// WhatsApp de la clínica (para el botón de consulta). Formato internacional sin signos: 54 + 9 + código de área + número.
export const WHATSAPP_CLINICA = "5493413050830";
export const WHATSAPP_CLINICA_VISIBLE = "341 305-0830";
export const urlWhatsApp = (mensaje) => `https://wa.me/${WHATSAPP_CLINICA}?text=${encodeURIComponent(mensaje)}`;

// Se llama al abrir una página pública (plan de referidos o consultas de ortodoncia): anota el escaneo (anónimo) para el control
// de las dueñas. `destino` dice cuál de las dos páginas se abrió. Nunca rompe ni demora la página.
export function registrarEscaneoPlan(destino = "referidos") {
  try {
    const lugar = new URLSearchParams(window.location.search).get("lugar") || "general";
    let visitante;
    try {
      visitante = localStorage.getItem("qr_visitante");
      if (!visitante) {
        visitante = crypto.randomUUID();
        localStorage.setItem("qr_visitante", visitante);
      }
    } catch {
      visitante = crypto.randomUUID();
    }
    fetch("/api/qr/escaneo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitante, lugar, destino }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // sin conteo, nada más
  }
}

export const pesosAR = (n) => `$${Number(n || 0).toLocaleString("es-AR")}`;
