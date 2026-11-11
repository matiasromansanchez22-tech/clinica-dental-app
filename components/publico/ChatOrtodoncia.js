"use client";

import { useEffect, useRef, useState } from "react";
import { urlWhatsApp, WHATSAPP_CLINICA_VISIBLE } from "@/lib/planReferidos";

const BIENVENIDA = "¡Hola! Soy el asistente virtual de la clínica 👋 Te puedo contar cómo es el tratamiento, cuánto sale y ayudarte a pedir turno. ¿Qué querés saber?";
const SUGERENCIAS = ["¿Cuánto sale?", "¿Cuánto dura el tratamiento?", "¿Cómo se paga?", "¿Qué diferencia hay entre los brackets?"];

// Asistente flotante de la página: contesta dudas sobre ortodoncia con la información de la clínica (valores y horarios reales).
// No da diagnósticos y, ante cualquier duda que no sabe, deriva al WhatsApp.
export default function ChatOrtodoncia() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([{ role: "assistant", content: BIENVENIDA }]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const fin = useRef(null);
  const entrada = useRef(null);

  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, pensando, abierto]);

  useEffect(() => {
    if (!abierto) return;
    entrada.current?.focus();
    const alTeclear = (e) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  async function enviar(contenido) {
    const pregunta = (contenido ?? texto).trim();
    if (!pregunta || pensando) return;
    const historial = [...mensajes, { role: "user", content: pregunta }];
    setMensajes(historial);
    setTexto("");
    setPensando(true);
    try {
      const r = await fetch("/api/publico/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // El saludo inicial no se manda: es solo de la pantalla.
        body: JSON.stringify({ mensajes: historial.slice(1) }),
      }).then((x) => x.json());
      setMensajes((m) => [...m, { role: "assistant", content: r.respuesta || r.error || `Ahora no puedo responder. Escribinos por WhatsApp al ${WHATSAPP_CLINICA_VISIBLE}.` }]);
    } catch {
      setMensajes((m) => [...m, { role: "assistant", content: `Ahora no puedo responder. Escribinos por WhatsApp al ${WHATSAPP_CLINICA_VISIBLE}.` }]);
    } finally {
      setPensando(false);
    }
  }

  function irAlTurno() {
    setAbierto(false);
    document.getElementById("turno")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          aria-label="Abrir el asistente: preguntá lo que quieras"
          className="fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-full bg-brand-brown px-5 py-3.5 text-base font-bold text-brand-cream shadow-lg transition-transform hover:-translate-y-0.5 sm:bottom-6 sm:right-6"
        >
          <span aria-hidden="true" className="text-xl">💬</span>
          Preguntanos
        </button>
      )}

      {abierto && (
        <div
          role="dialog"
          aria-label="Asistente virtual de la clínica"
          className="fixed inset-x-3 bottom-3 top-16 z-40 flex flex-col overflow-hidden rounded-3xl bg-brand-cream shadow-2xl ring-1 ring-brand-tan sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:h-[600px] sm:max-h-[calc(100vh-3rem)] sm:w-[400px]"
        >
          <div className="flex items-center justify-between bg-brand-brown px-5 py-4 text-brand-cream">
            <div>
              <p className="font-heading text-lg font-extrabold leading-tight">Asistente de la clínica</p>
              <p className="text-xs text-brand-tan">Respondo tus dudas sobre ortodoncia</p>
            </div>
            <button onClick={() => setAbierto(false)} aria-label="Cerrar el asistente" className="rounded-full p-2 text-xl leading-none hover:bg-white/10">
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {mensajes.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <p
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-snug ${
                    m.role === "user" ? "rounded-br-md bg-brand-green text-brand-cream" : "rounded-bl-md bg-white text-brand-charcoal shadow-sm ring-1 ring-brand-tan/60"
                  }`}
                >
                  {m.content}
                </p>
              </div>
            ))}
            {pensando && (
              <div className="flex justify-start">
                <p className="rounded-2xl rounded-bl-md bg-white px-4 py-3 text-brand-brown shadow-sm ring-1 ring-brand-tan/60" aria-label="Escribiendo">
                  <span className="inline-flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-brown/60" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-brown/60" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-brown/60" style={{ animationDelay: "300ms" }} />
                  </span>
                </p>
              </div>
            )}
            {mensajes.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGERENCIAS.map((s) => (
                  <button key={s} onClick={() => enviar(s)} className="rounded-full border-2 border-brand-tan bg-white px-3.5 py-2 text-sm font-semibold text-brand-brown hover:border-brand-brown">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={fin} />
          </div>

          <div className="border-t border-brand-tan/70 bg-white px-3 pb-3 pt-2">
            <div className="mb-2 flex gap-2">
              <button onClick={irAlTurno} className="flex-1 rounded-full bg-brand-green px-3 py-2 text-sm font-bold text-brand-cream">
                Elegir un horario
              </button>
              <a
                href={urlWhatsApp("¡Hola! Tengo una consulta sobre ortodoncia.")}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded-full border-2 border-brand-green px-3 py-2 text-center text-sm font-bold text-brand-green"
              >
                WhatsApp
              </a>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviar();
              }}
              className="flex gap-2"
            >
              <input
                ref={entrada}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                maxLength={500}
                placeholder="Escribí tu pregunta…"
                className="min-w-0 flex-1 rounded-full border-2 border-brand-tan bg-brand-cream px-4 py-2.5 text-base outline-none focus:border-brand-brown"
              />
              <button type="submit" disabled={!texto.trim() || pensando} className="rounded-full bg-brand-brown px-5 py-2.5 text-base font-bold text-brand-cream disabled:opacity-50">
                Enviar
              </button>
            </form>
            <p className="mt-2 px-1 text-[11px] leading-snug text-brand-charcoal/55">
              Asistente virtual: no reemplaza la consulta con el profesional. Las preguntas se guardan de forma anónima para mejorar la información.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
