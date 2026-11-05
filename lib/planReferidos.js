// Dirección pública del plan de referidos (la que abre el QR del cartel). Si algún día cambia el dominio de la
// aplicación, se cambia acá y se vuelve a imprimir el cartel.
export const URL_PLAN_REFERIDOS = "https://clinica-dental-app-gamma.vercel.app/referidos";

// Link del plan para un lugar puntual (cada cartel con QR lleva el suyo, así se sabe de cuál vienen los escaneos).
export const urlPlanReferidos = (lugar) => (lugar && lugar !== "general" ? `${URL_PLAN_REFERIDOS}?lugar=${lugar}` : URL_PLAN_REFERIDOS);

// Se llama al abrir la página pública del plan: anota el escaneo (anónimo) para el control de las dueñas. Nunca
// rompe ni demora la página.
export function registrarEscaneoPlan() {
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
      body: JSON.stringify({ visitante, lugar }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // sin conteo, nada más
  }
}

export const pesosAR = (n) => `$${Number(n || 0).toLocaleString("es-AR")}`;
