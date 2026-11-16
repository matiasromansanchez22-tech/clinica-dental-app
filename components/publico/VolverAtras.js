"use client";

// Botón "← Volver" para las páginas públicas: se muestra cuando la persona llegó desde la otra página (ortodoncia ↔ odontología
// general). Si vino navegando dentro del mismo sitio, vuelve exactamente a donde estaba (con el lugar de la página donde se quedó);
// si no hay historial (por ejemplo, abrió el link en otra pestaña), la lleva a la página de origen.
export default function VolverAtras({ href, texto }) {
  function volver(e) {
    try {
      if (window.history.length > 1 && document.referrer && new URL(document.referrer).origin === window.location.origin) {
        e.preventDefault();
        window.history.back();
      }
    } catch {
      // se usa el link de siempre
    }
  }
  return (
    <a href={href} onClick={volver} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-brown shadow-sm ring-1 ring-brand-tan/70 hover:ring-brand-brown">
      <span aria-hidden="true">←</span> {texto}
    </a>
  );
}
