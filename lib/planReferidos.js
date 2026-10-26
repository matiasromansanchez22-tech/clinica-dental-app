// Dirección pública del plan de referidos (la que abre el QR del cartel). Si algún día cambia el dominio de la
// aplicación, se cambia acá y se vuelve a imprimir el cartel.
export const URL_PLAN_REFERIDOS = "https://clinica-dental-app-gamma.vercel.app/referidos";

export const pesosAR = (n) => `$${Number(n || 0).toLocaleString("es-AR")}`;
