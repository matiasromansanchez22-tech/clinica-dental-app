"use client";

import { useRef, useState } from "react";
import { crearFacturacionAsorPacientesMasivo } from "@/lib/data/facturacionObrasSociales";
import { headerDeSesion } from "@/lib/authHeaders";

function esMismaLinea(a, b) {
  return (
    (a.nroPresupuesto || "").trim() === (b.nroPresupuesto || "").trim() &&
    (a.paciente || "").trim().toUpperCase() === (b.paciente || "").trim().toUpperCase() &&
    (a.codigoPrestacion || "") === (b.codigoPrestacion || "") &&
    Math.abs((a.total || 0) - (b.total || 0)) < 1
  );
}

export default function ImportarPdfAsorModal({ obrasSocialesExistentes, facturacionExistente, onClose, onGuardado }) {
  const [obraSocial, setObraSocial] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [lineas, setLineas] = useState(null);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  // Por defecto, las líneas que ya estaban cargadas se saltean (para no duplicar).
  const [omitirRepetidas, setOmitirRepetidas] = useState(true);
  const inputRef = useRef(null);

  async function handlePrevisualizar() {
    setError(null);
    if (!archivo) {
      setError("Elegí un archivo PDF primero.");
      return;
    }
    setLeyendo(true);
    setLineas(null);
    try {
      const formData = new FormData();
      formData.append("archivo", archivo);
      const res = await fetch("/api/asor/parsear-pdf", {
        method: "POST",
        headers: await headerDeSesion(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo leer el PDF.");
      setLineas(data.lineas);
    } catch (err) {
      setError(err.message);
    } finally {
      setLeyendo(false);
    }
  }

  async function handleConfirmar() {
    if (!obraSocial.trim()) {
      setError("Elegí a qué obra social corresponde este PDF.");
      return;
    }
    const aGuardar = omitirRepetidas ? lineasNuevas : lineas;
    if (aGuardar.length === 0) {
      setError("Todas las líneas de este PDF ya están cargadas: no hay nada nuevo para guardar.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await crearFacturacionAsorPacientesMasivo(obraSocial.trim(), aGuardar);
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  // Compara contra lo ya cargado para esa obra social — para detectar si este PDF (o parte de él)
  // ya se importó antes. Cada línea ya cargada se "gasta" una sola vez: si el PDF trae la misma
  // línea dos veces de verdad y solo una estaba cargada, la otra se considera nueva.
  const existentesDeEstaObraSocial = (facturacionExistente || []).filter(
    (f) => f.obraSocial.trim().toUpperCase() === obraSocial.trim().toUpperCase()
  );
  const indicesRepetidos = new Set();
  if (lineas && obraSocial.trim() && existentesDeEstaObraSocial.length > 0) {
    const disponibles = [...existentesDeEstaObraSocial];
    lineas.forEach((l, i) => {
      const pos = disponibles.findIndex((e) => esMismaLinea(l, e));
      if (pos >= 0) {
        indicesRepetidos.add(i);
        disponibles.splice(pos, 1);
      }
    });
  }
  const lineasDuplicadas = lineas ? lineas.filter((_, i) => indicesRepetidos.has(i)) : [];
  const lineasNuevas = lineas ? lineas.filter((_, i) => !indicesRepetidos.has(i)) : [];
  const pacientesDuplicados = [...new Set(lineasDuplicadas.map((l) => l.paciente))];

  const pacientes = lineas
    ? Object.values(
        lineas.reduce((acc, l, i) => {
          const clave = `${l.nroPresupuesto}|${l.paciente}`;
          if (!acc[clave]) acc[clave] = { nroPresupuesto: l.nroPresupuesto, paciente: l.paciente, nroDoc: l.nroDoc, items: [], repetidas: 0 };
          acc[clave].items.push(l);
          if (indicesRepetidos.has(i)) acc[clave].repetidas += 1;
          return acc;
        }, {})
      )
    : [];
  const lineasAGuardar = omitirRepetidas ? lineasNuevas : lineas || [];
  const totalGeneral = lineas ? lineas.reduce((acc, l) => acc + l.pendiente, 0) : 0;
  const totalAGuardar = lineasAGuardar.reduce((acc, l) => acc + l.pendiente, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">Importar PDF de ASOR (beta)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Lee automáticamente el PDF de "Facturación en Gestión" por paciente. Revisá siempre la vista previa antes
          de confirmar — es un lector automático y puede equivocarse en casos raros.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        {!lineas && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Archivo PDF
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={handlePrevisualizar}
              disabled={leyendo || !archivo}
              className="self-start rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {leyendo ? "Leyendo..." : "Previsualizar"}
            </button>
          </div>
        )}

        {lineas && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Obra social de este PDF
              <input
                list="obras-sociales-existentes"
                value={obraSocial}
                onChange={(e) => setObraSocial(e.target.value)}
                placeholder="Ej. Iapos, Iosfa, Avalian..."
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
              <datalist id="obras-sociales-existentes">
                {obrasSocialesExistentes.map((os) => (
                  <option key={os} value={os} />
                ))}
              </datalist>
            </label>

            <div className="rounded-md bg-brand-tan/20 px-3 py-2 text-sm font-semibold text-brand-brown">
              {pacientes.length} paciente{pacientes.length === 1 ? "" : "s"} — {lineas.length} líneas — Total
              pendiente: ${totalGeneral.toLocaleString("es-AR")}
              {lineasDuplicadas.length > 0 && omitirRepetidas && (
                <span className="mt-0.5 block text-xs font-medium text-emerald-800">
                  Se van a cargar {lineasNuevas.length} líneas nuevas por ${totalAGuardar.toLocaleString("es-AR")}
                </span>
              )}
            </div>

            {lineasDuplicadas.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p>
                  ⚠️ {lineasDuplicadas.length} de {lineas.length} líneas ya están cargadas para "{obraSocial}" — parece
                  que este PDF (o parte) ya se importó antes. Pacientes repetidos: {pacientesDuplicados.join(", ")}.
                </p>
                <label className="mt-2 flex cursor-pointer items-start gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={omitirRepetidas}
                    onChange={(e) => setOmitirRepetidas(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    Saltear las {lineasDuplicadas.length} líneas repetidas y cargar solo las {lineasNuevas.length} nuevas
                    <span className="block text-xs font-normal text-amber-800">
                      Recomendado. Si lo destildás, se cargan todas las líneas y las repetidas quedan duplicadas.
                    </span>
                  </span>
                </label>
              </div>
            )}

            <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-brown text-white">
                    <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                    <th className="px-3 py-2 text-left font-semibold">DNI</th>
                    <th className="px-3 py-2 text-left font-semibold">N° Presup.</th>
                    <th className="px-3 py-2 text-right font-semibold">Líneas</th>
                    <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                    <th className="px-3 py-2 text-left font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pacientes.map((p) => {
                    const subtotal = p.items.reduce((acc, l) => acc + l.pendiente, 0);
                    return (
                      <tr key={`${p.nroPresupuesto}|${p.paciente}`} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-medium text-gray-900">{p.paciente}</td>
                        <td className="px-3 py-2 text-gray-600">{p.nroDoc || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{p.nroPresupuesto}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{p.items.length}</td>
                        <td className="px-3 py-2 text-right text-gray-900">${subtotal.toLocaleString("es-AR")}</td>
                        <td className="px-3 py-2 text-xs">
                          {p.repetidas === 0 ? (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-800">nuevo</span>
                          ) : p.repetidas === p.items.length ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">ya cargado</span>
                          ) : (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">
                              {p.repetidas} de {p.items.length} ya cargadas
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setLineas(null);
                  setArchivo(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Elegir otro archivo
              </button>
              <button
                onClick={handleConfirmar}
                disabled={guardando}
                className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
              >
                {guardando
                  ? "Guardando..."
                  : lineasDuplicadas.length > 0 && omitirRepetidas
                    ? `Cargar solo las ${lineasNuevas.length} nuevas`
                    : "Confirmar carga"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
