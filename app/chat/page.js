"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { obtenerPerfiles } from "@/lib/data/perfiles";
import { eliminarMensaje, enviarMensaje, obtenerMensajes, suscribirseAChat } from "@/lib/data/chat";

function formatoHora(iso) {
  const fecha = new Date(iso);
  const hoy = new Date();
  const esHoy = fecha.toDateString() === hoy.toDateString();
  const hora = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  if (esHoy) return hora;
  return `${fecha.toLocaleDateString("es-AR")} ${hora}`;
}

export default function ChatPage() {
  const { user, perfil } = useAuth();
  const [mensajes, setMensajes] = useState([]);
  const [perfiles, setPerfiles] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef(null);

  async function recargar() {
    try {
      setMensajes(await obtenerMensajes());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    obtenerPerfiles()
      .then((lista) => setPerfiles(Object.fromEntries(lista.map((p) => [p.id, p]))))
      .catch((e) => setError(e.message));

    recargar().finally(() => setCargando(false));

    const cancelar = suscribirseAChat(() => recargar());
    return cancelar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    setError(null);
    try {
      await enviarMensaje(texto);
      setTexto("");
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function borrar(id) {
    if (!window.confirm("¿Borrar este mensaje?")) return;
    try {
      await eliminarMensaje(id);
    } catch (e) {
      setError(e.message);
    }
  }

  function alPresionarTecla(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-64px)] max-w-2xl flex-col p-6">
      <h1 className="text-2xl font-bold text-gray-900">💬 Chat de la clínica</h1>
      <p className="mt-1 text-sm text-gray-500">Un solo lugar para avisos y coordinación entre todo el personal.</p>

      {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mt-4 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4">
        {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
        {!cargando && mensajes.length === 0 && (
          <p className="text-sm text-gray-500">Todavía no hay mensajes. ¡Escribí el primero!</p>
        )}
        <div className="flex flex-col gap-3">
          {mensajes.map((m) => {
            const esPropio = m.autorId === user?.id;
            const autor = perfiles[m.autorId];
            return (
              <div key={m.id} className={`flex flex-col ${esPropio ? "items-end" : "items-start"}`}>
                <div
                  className={`group relative max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    esPropio ? "bg-brand-brown text-white" : "border border-gray-200 bg-white text-gray-900"
                  }`}
                >
                  {!esPropio && <p className="mb-0.5 text-xs font-semibold text-brand-brown">{autor?.nombre ?? "—"}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                  <p className={`mt-1 text-right text-[10px] ${esPropio ? "text-white/70" : "text-gray-400"}`}>
                    {formatoHora(m.creadoEn)}
                  </p>
                  {(esPropio || perfil?.rol === "Duena") && (
                    <button
                      type="button"
                      onClick={() => borrar(m.id)}
                      className={`absolute -top-2 ${esPropio ? "-left-2" : "-right-2"} hidden h-5 w-5 items-center justify-center rounded-full bg-white text-xs text-red-600 shadow group-hover:flex`}
                      title="Borrar mensaje"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={finRef} />
        </div>
      </div>

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={alPresionarTecla}
          rows={1}
          placeholder="Escribí un mensaje..."
          className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          className="h-fit rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </main>
  );
}
