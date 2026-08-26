"use client";

import { useEffect, useMemo, useState } from "react";
import { crearCobroOrtodoncia } from "@/lib/data/cajaOrtodoncia";
import { obtenerConfiguracionOrtodoncia } from "@/lib/data/pacientesOrtodoncia";

const CONCEPTOS = [
  "Control",
  "Reposición de bracket",
  "Instalación (contado)",
  "Instalación (2 cuotas)",
  "Desinstalación",
  "Consulta de ortodoncia",
  "Urgencia",
];
const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR"];
const BRACKETS = ["Metálico", "Porcelana"];

export default function CobroOrtodonciaFormModal({ fecha, pacientes, onClose, onCreado }) {
  const [pacienteId, setPacienteId] = useState("");
  const [concepto, setConcepto] = useState("Control");
  const [cantidadControlesAbonados, setCantidadControlesAbonados] = useState(1);
  const [bracketReposicion, setBracketReposicion] = useState("Metálico");
  const [cantidadBrackets, setCantidadBrackets] = useState(1);
  const [seDespegoBracket, setSeDespegoBracket] = useState(false);
  const [precios, setPrecios] = useState({ precio_bracket_metalico: 0, precio_bracket_porcelana: 0 });
  const [importe, setImporte] = useState(0);
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    obtenerConfiguracionOrtodoncia().then(setPrecios);
  }, []);

  const paciente = useMemo(() => pacientes.find((p) => p.id === pacienteId), [pacienteId, pacientes]);

  const precioPorBracket =
    bracketReposicion === "Porcelana" ? precios.precio_bracket_porcelana : precios.precio_bracket_metalico;

  useEffect(() => {
    if (!paciente) return;
    if (concepto === "Control") {
      const valorControles = Number(paciente.valorControl || 0) * Number(cantidadControlesAbonados || 1);
      const valorBrackets = seDespegoBracket ? Number(cantidadBrackets || 0) * precioPorBracket : 0;
      setImporte(valorControles + valorBrackets);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId, concepto, cantidadControlesAbonados, seDespegoBracket, cantidadBrackets, bracketReposicion, precios]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!pacienteId) {
      setError("Falta elegir el paciente.");
      return;
    }
    if (!importe || Number(importe) <= 0) {
      setError("El importe tiene que ser mayor a cero.");
      return;
    }

    setGuardando(true);
    try {
      await crearCobroOrtodoncia({
        fecha,
        pacienteId,
        ortodoncistaId: paciente.ortodoncistaId,
        concepto,
        cantidadControlesAbonados: concepto === "Control" ? Number(cantidadControlesAbonados) : null,
        bracketReposicion:
          concepto === "Reposición de bracket" || (concepto === "Control" && seDespegoBracket)
            ? bracketReposicion
            : null,
        cantidadBrackets:
          concepto === "Reposición de bracket" || (concepto === "Control" && seDespegoBracket)
            ? Number(cantidadBrackets)
            : null,
        importe: Number(importe),
        medioPago,
        observaciones,
      });
      onCreado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Nuevo cobro — Ortodoncia</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Paciente
            <select
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              <option value="">Elegí un paciente...</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          {paciente && (
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              Ortodoncista habitual: <span className="font-medium">{paciente.ortodoncista}</span>
              {" · "}Cuota control: {paciente.valorControl ? `$${Number(paciente.valorControl).toLocaleString("es-AR")}` : "—"}
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Concepto
            <select
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              {CONCEPTOS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {concepto === "Control" && (
            <>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Cantidad de controles abonados
                <input
                  type="number"
                  min={1}
                  value={cantidadControlesAbonados}
                  onChange={(e) => setCantidadControlesAbonados(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={seDespegoBracket}
                  onChange={(e) => setSeDespegoBracket(e.target.checked)}
                />
                Se despegó algún bracket (se suma al total del control)
              </label>

              {seDespegoBracket && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    Tipo de bracket
                    <select
                      value={bracketReposicion}
                      onChange={(e) => setBracketReposicion(e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1.5"
                    >
                      {BRACKETS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    Cantidad despegada
                    <input
                      type="number"
                      min={1}
                      value={cantidadBrackets}
                      onChange={(e) => setCantidadBrackets(e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1.5"
                    />
                  </label>
                  <p className="col-span-2 text-xs text-gray-500">
                    ${precioPorBracket.toLocaleString("es-AR")} por bracket ({bracketReposicion}) × {cantidadBrackets || 0} = $
                    {(precioPorBracket * Number(cantidadBrackets || 0)).toLocaleString("es-AR")}, ya sumado al importe
                    de abajo.
                  </p>
                </div>
              )}
            </>
          )}

          {concepto === "Reposición de bracket" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Tipo de bracket
                <select
                  value={bracketReposicion}
                  onChange={(e) => setBracketReposicion(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                >
                  {BRACKETS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Cantidad
                <input
                  type="number"
                  min={1}
                  value={cantidadBrackets}
                  onChange={(e) => setCantidadBrackets(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Importe
              <input
                type="number"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Medio de pago
              <select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                {MEDIOS_PAGO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Observaciones
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Registrar cobro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
