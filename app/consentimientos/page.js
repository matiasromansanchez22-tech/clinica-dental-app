"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { linkWhatsApp, nombreCercano } from "@/lib/whatsapp";
import { marcarConsentimientoFirmado, obtenerConsentimientosPendientes } from "@/lib/data/consentimientos";

function sumarDias(fechaISO, dias) {
  const d = new Date(`${fechaISO}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fechaCorta(fechaISO) {
  if (!fechaISO) return "—";
  const [a, m, d] = fechaISO.split("-");
  return `${d}/${m}/${a.slice(2)}`;
}

function mensajeConsentimiento(nombre) {
  return `¡Hola ${nombreCercano(nombre)}! Te escribimos desde Clínica Dental Marianela Ramírez. Nos falta que firmes el consentimiento de tratamiento. Podés hacerlo cuando vengas a tu próximo turno: avisanos al llegar. ¡Gracias!`;
}

const FILTROS = [
  { id: "turno", etiqueta: "Con turno en los próximos 14 días" },
  { id: "recientes", etiqueta: "Vinieron en los últimos 60 días" },
  { id: "todos", etiqueta: "Todos" },
];

function ConsentimientosContenido() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [sistema, setSistema] = useState("general");
  const [filtro, setFiltro] = useState("turno");
  const [busqueda, setBusqueda] = useState("");
  const [marcando, setMarcando] = useState(null);

  useEffect(() => {
    let activo = true;
    obtenerConsentimientosPendientes()
      .then((d) => activo && setDatos(d))
      .catch((e) => activo && setError(e.message));
    return () => {
      activo = false;
    };
  }, []);

  const hoy = datos?.hoy;
  const lista = useMemo(() => {
    if (!datos) return [];
    const base = sistema === "general" ? datos.general : datos.ortodoncia;
    const texto = busqueda.trim().toLowerCase();
    const limiteTurno = sumarDias(hoy, 14);
    const limiteVisita = sumarDias(hoy, -60);
    return base
      .filter((p) => !texto || p.nombre.toLowerCase().includes(texto))
      .filter((p) => {
        if (filtro === "turno") return p.proximoTurno && p.proximoTurno <= limiteTurno;
        if (filtro === "recientes") return p.ultimaVisita && p.ultimaVisita >= limiteVisita;
        return true;
      })
      .sort((a, b) => {
        if (a.proximoTurno && b.proximoTurno) return a.proximoTurno.localeCompare(b.proximoTurno);
        if (a.proximoTurno) return -1;
        if (b.proximoTurno) return 1;
        return (b.ultimaVisita || "").localeCompare(a.ultimaVisita || "") || a.nombre.localeCompare(b.nombre, "es");
      });
  }, [datos, sistema, filtro, busqueda, hoy]);

  const conTurno = (arr) => arr.filter((p) => p.proximoTurno && p.proximoTurno <= sumarDias(hoy, 14)).length;

  async function marcar(p) {
    if (!window.confirm(`¿Confirmás que ${p.nombre} ya firmó el consentimiento?`)) return;
    setMarcando(p.id);
    setError(null);
    try {
      await marcarConsentimientoFirmado(p.sistema, p.id);
      setDatos((d) => ({ ...d, [p.sistema]: d[p.sistema].filter((x) => x.id !== p.id) }));
    } catch (e) {
      setError(e.message);
    } finally {
      setMarcando(null);
    }
  }

  function descargarCSV() {
    const filas = [["Sistema", "Paciente", "Teléfono", "Profesional", "Próximo turno", "Última visita"]];
    for (const p of lista) filas.push([p.sistema === "general" ? "General" : "Ortodoncia", p.nombre, p.telefono || "", p.profesional || "", fechaCorta(p.proximoTurno), fechaCorta(p.ultimaVisita)]);
    const texto = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `consentimientos-pendientes-${sistema}-${hoy}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900 print:text-xl">✍️ Consentimientos pendientes</h1>
      <p className="mt-1 text-sm text-gray-500 print:hidden">
        Pacientes a los que todavía les falta firmar el consentimiento. Los que vienen pronto están primero, para hacérselo firmar en la visita.
        Cuando firman, tocá «Ya firmó» y sale de la lista.
      </p>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {!datos && !error && <p className="mt-6 text-sm text-gray-500">Cargando...</p>}

      {datos && (
        <>
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            {[
              { id: "general", etiqueta: "Odontología General", lista: datos.general },
              { id: "ortodoncia", etiqueta: "Ortodoncia", lista: datos.ortodoncia },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSistema(t.id)}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${sistema === t.id ? "border-brand-brown bg-brand-brown text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
              >
                {t.etiqueta}: {t.lista.length} sin firmar
                <span className={`ml-2 text-xs ${sistema === t.id ? "text-white/80" : "text-gray-500"}`}>({conTurno(t.lista)} vienen pronto)</span>
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${filtro === f.id ? "border-brand-brown bg-brand-tan/40 text-brand-brown" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
              >
                {f.etiqueta}
              </button>
            ))}
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre..."
              className="ml-auto rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
            <button onClick={descargarCSV} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
              ⬇ Descargar para Excel
            </button>
            <button onClick={() => window.print()} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
              🖨 Imprimir
            </button>
          </div>

          <p className="mt-3 text-sm font-medium text-gray-700">
            {lista.length} paciente{lista.length === 1 ? "" : "s"} en esta lista
          </p>

          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white print:bg-gray-200 print:text-black">
                  <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                  <th className="px-3 py-2 text-left font-semibold">{sistema === "general" ? "Profesional" : "Ortodoncista"}</th>
                  <th className="px-3 py-2 text-left font-semibold">Próximo turno</th>
                  <th className="px-3 py-2 text-left font-semibold">Última visita</th>
                  <th className="px-3 py-2 text-left font-semibold">Firma</th>
                  <th className="px-3 py-2 print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                      No hay pacientes en esta lista. ✅
                    </td>
                  </tr>
                )}
                {lista.map((p) => (
                  <tr key={`${p.sistema}-${p.id}`} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {p.nombre}
                      {p.detalle && <span className="block text-[11px] font-normal text-gray-500">{p.detalle}</span>}
                      {p.telefono && <span className="block text-[11px] font-normal text-gray-500">{p.telefono}</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{p.profesional || "—"}</td>
                    <td className={`whitespace-nowrap px-3 py-2 tabular-nums ${p.proximoTurno && p.proximoTurno <= sumarDias(hoy, 14) ? "font-semibold text-emerald-700" : "text-gray-700"}`}>
                      {fechaCorta(p.proximoTurno)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-600">{fechaCorta(p.ultimaVisita)}</td>
                    <td className="px-3 py-2 text-gray-400">______________</td>
                    <td className="px-3 py-2 text-right print:hidden">
                      <div className="flex justify-end gap-2">
                        {p.telefono && (
                          <a
                            href={linkWhatsApp(p.telefono, mensajeConsentimiento(p.nombre))}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-emerald-600 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            WhatsApp
                          </a>
                        )}
                        <button
                          onClick={() => marcar(p)}
                          disabled={marcando === p.id}
                          className="rounded-md border border-brand-brown/40 px-2 py-1 text-xs font-medium text-brand-brown hover:bg-brand-tan/30 disabled:opacity-50"
                        >
                          {marcando === p.id ? "..." : "✓ Ya firmó"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

export default function ConsentimientosPage() {
  const { perfil, cargando } = useAuth();
  if (cargando) return null;
  if (!["Duena", "Secretaria"].includes(perfil?.rol)) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Acceso restringido — esta sección no está disponible para este usuario.
        </div>
      </main>
    );
  }
  return <ConsentimientosContenido />;
}
