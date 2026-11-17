"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { borrarLeidas, marcarNotificacionLeida, marcarTodasLeidas, obtenerNotificaciones } from "@/lib/data/notificaciones";

// Campanita con la "cortina" de notificaciones (solo Dueñas): cada aviso que el sistema le manda al celular queda guardado acá, con su
// hora y un acceso directo a la pantalla de la que habla. Las no leídas se marcan con un punto y suman al numerito de la campana.
const REVISAR_CADA_MS = 60 * 1000;

function haceCuanto(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" });
  const fecha = (x) => x.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  if (fecha(d) === fecha(new Date())) return `hoy ${hora}`;
  if (fecha(d) === fecha(new Date(Date.now() - 86400000))) return `ayer ${hora}`;
  return `${d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit" })} ${hora}`;
}

export default function CortinaNotificaciones() {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [datos, setDatos] = useState({ disponible: false, lista: [] });

  const cargar = useCallback(async () => {
    try {
      setDatos(await obtenerNotificaciones());
    } catch {
      // sin cortina
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, REVISAR_CADA_MS);
    const alVolver = () => document.visibilityState === "visible" && cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [cargar]);

  if (!datos.disponible) return null;
  const noLeidas = datos.lista.filter((n) => !n.leida_en).length;
  const hayLeidas = datos.lista.some((n) => n.leida_en);

  async function abrir(n) {
    setAbierta(false);
    if (!n.leida_en) {
      await marcarNotificacionLeida(n.id);
      cargar();
    }
    if (n.url) router.push(n.url);
  }

  return (
    <>
      <button
        onClick={() => {
          setAbierta((a) => !a);
          cargar();
        }}
        className="relative rounded-md px-2 py-1 text-lg leading-none text-brand-charcoal/70 hover:bg-brand-tan/40"
        aria-label={`Notificaciones${noLeidas ? `, ${noLeidas} sin leer` : ""}`}
        title="Notificaciones"
      >
        🔔
        {noLeidas > 0 && <span className="absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-red-600 px-1 text-center text-[11px] font-bold leading-[1.1rem] text-white">{noLeidas > 99 ? "99+" : noLeidas}</span>}
      </button>

      {abierta && (
        <>
          <div className="fixed inset-0 z-[119] bg-black/10" onClick={() => setAbierta(false)} aria-hidden="true" />
          <style>{`@keyframes bajarCortina { from { transform: translateY(-14px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
          <section
            className="fixed right-3 top-16 z-[120] flex max-h-[75vh] w-[26rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-b-2xl rounded-t-md border border-brand-tan bg-white shadow-2xl"
            style={{ animation: "bajarCortina .18s ease-out" }}
            role="dialog"
            aria-label="Notificaciones"
          >
            <header className="flex items-center justify-between gap-2 border-b border-brand-tan/60 bg-brand-cream px-4 py-2.5">
              <p className="font-heading text-base font-bold text-brand-brown">🔔 Notificaciones</p>
              <button onClick={() => setAbierta(false)} className="text-sm text-gray-500 hover:text-gray-800" aria-label="Cerrar">
                ✕
              </button>
            </header>
            <div className="overflow-y-auto">
              {datos.lista.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-500">Todavía no hay notificaciones. Desde ahora, cada aviso que te llegue al celular queda guardado acá.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {datos.lista.map((n) => (
                    <li key={n.id}>
                      <button onClick={() => abrir(n)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-brand-cream/70 ${n.leida_en ? "" : "bg-amber-50/70"}`}>
                        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.leida_en ? "bg-transparent" : "bg-red-600"}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm text-gray-900 ${n.leida_en ? "font-medium" : "font-bold"}`}>{n.titulo}</span>
                          {n.mensaje && <span className="mt-0.5 block text-xs leading-snug text-gray-700">{n.mensaje}</span>}
                          <span className="mt-1 block text-[11px] text-gray-500">{haceCuanto(n.created_at)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {datos.lista.length > 0 && (
              <footer className="flex items-center justify-between gap-2 border-t border-brand-tan/60 bg-brand-cream px-4 py-2 text-xs">
                <button
                  disabled={noLeidas === 0}
                  onClick={async () => {
                    await marcarTodasLeidas();
                    cargar();
                  }}
                  className="font-semibold text-brand-brown hover:underline disabled:opacity-40"
                >
                  Marcar todas como leídas
                </button>
                <button
                  disabled={!hayLeidas}
                  onClick={async () => {
                    await borrarLeidas();
                    cargar();
                  }}
                  className="text-gray-600 hover:underline disabled:opacity-40"
                >
                  Borrar las leídas
                </button>
              </footer>
            )}
          </section>
        </>
      )}
    </>
  );
}
