"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { obtenerPerfiles } from "@/lib/data/perfiles";
import {
  crearPlantilla,
  eliminarMensaje,
  eliminarPlantilla,
  enviarMensaje,
  obtenerMensajes,
  obtenerPlantillas,
  suscribirseAChat,
} from "@/lib/data/chat";

// Resumen corto para mostrar en listas angostas (el desplegable de "/" y
// los chips) — las plantillas con varios renglones no tienen que ocupar
// un montón de espacio ahí; al elegirlas igual se carga el texto completo.
function previaPlantilla(texto, maxLargo = 40) {
  const primeraLinea = texto.split("\n")[0];
  const tieneMas = texto.includes("\n") || primeraLinea.length > maxLargo;
  const recortada = primeraLinea.slice(0, maxLargo);
  return tieneMas ? `${recortada}…` : recortada;
}

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
  const [plantillas, setPlantillas] = useState([]);
  const [mostrarPlantillas, setMostrarPlantillas] = useState(false);
  const [nuevaPlantilla, setNuevaPlantilla] = useState("");
  const [indiceSugerencia, setIndiceSugerencia] = useState(0);
  const finRef = useRef(null);
  const textareaRef = useRef(null);

  // Escribir "/" al principio del mensaje muestra las plantillas que
  // coincidan, como en WhatsApp Business.
  const mostrandoSugerencias = texto.startsWith("/");
  const filtroSugerencias = texto.slice(1).toLowerCase();
  const sugerencias = mostrandoSugerencias
    ? plantillas.filter((p) => p.texto.toLowerCase().includes(filtroSugerencias))
    : [];

  useEffect(() => {
    setIndiceSugerencia(0);
  }, [texto]);

  function recargarPlantillas() {
    obtenerPlantillas()
      .then(setPlantillas)
      .catch((e) => setError(e.message));
  }

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
    recargarPlantillas();

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
    if (sugerencias.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndiceSugerencia((i) => Math.min(i + 1, sugerencias.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndiceSugerencia((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        usarPlantilla(sugerencias[indiceSugerencia]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setTexto("");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  function usarPlantilla(p) {
    setTexto(p.texto);
    textareaRef.current?.focus();
  }

  async function agregarPlantilla() {
    if (!nuevaPlantilla.trim()) return;
    try {
      await crearPlantilla(nuevaPlantilla);
      setNuevaPlantilla("");
      recargarPlantillas();
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrarPlantilla(id) {
    if (!window.confirm("¿Borrar esta plantilla?")) return;
    try {
      await eliminarPlantilla(id);
      recargarPlantillas();
    } catch (e) {
      setError(e.message);
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
                  <p className={`mb-0.5 text-xs font-semibold ${esPropio ? "text-white/90" : "text-brand-brown"}`}>
                    {esPropio ? "Vos" : (autor?.nombre ?? "—")}
                  </p>
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

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {plantillas.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => usarPlantilla(p)}
            className="rounded-full border border-brand-brown/40 bg-brand-tan/20 px-3 py-1 text-xs text-brand-brown hover:bg-brand-tan/40"
            title={p.texto}
          >
            {previaPlantilla(p.texto)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMostrarPlantillas((v) => !v)}
          className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
        >
          {mostrarPlantillas ? "Cerrar plantillas" : "✏️ Plantillas"}
        </button>
      </div>

      {mostrarPlantillas && (
        <div className="mt-2 flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-500">
            Podés escribir varios renglones (por ejemplo un informe con campos para completar).
          </p>
          <textarea
            value={nuevaPlantilla}
            onChange={(e) => setNuevaPlantilla(e.target.value)}
            rows={4}
            placeholder={"Nueva plantilla, ej.:\n📋 INFORME PACIENTE\n\n👤 Paciente:\n💳 Tipo:"}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={agregarPlantilla}
            disabled={!nuevaPlantilla.trim()}
            className="w-fit rounded-md bg-brand-brown px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
          >
            Agregar plantilla
          </button>
          {plantillas.length > 0 && (
            <ul className="mt-1 flex flex-col gap-2 border-t border-gray-200 pt-2">
              {plantillas.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2 text-xs text-gray-700">
                  <span className="whitespace-pre-line">{p.texto}</span>
                  {(p.autorId === user?.id || perfil?.rol === "Duena") && (
                    <button
                      type="button"
                      onClick={() => borrarPlantilla(p.id)}
                      className="shrink-0 text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="relative mt-3">
        {mostrandoSugerencias && sugerencias.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 max-h-48 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
            {sugerencias.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => usarPlantilla(p)}
                title={p.texto}
                className={`block w-full truncate px-3 py-2 text-left text-sm ${
                  i === indiceSugerencia ? "bg-brand-tan/40" : "hover:bg-gray-50"
                }`}
              >
                {previaPlantilla(p.texto, 60)}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={alPresionarTecla}
            rows={Math.min(Math.max(texto.split("\n").length, 1), 8)}
            placeholder="Escribí un mensaje... (tip: / para plantillas)"
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
      </div>
    </main>
  );
}
