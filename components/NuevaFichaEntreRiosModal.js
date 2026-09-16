"use client";

import { useEffect, useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerPrestacionesObraSocial } from "@/lib/data/caja";
import { crearFichaEntreRiosManual, OBRAS_SOCIALES_ENTRE_RIOS } from "@/lib/data/facturacionObrasSociales";

export default function NuevaFichaEntreRiosModal({ pacientes, profesionales, onClose, onGuardado }) {
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [obraSocial, setObraSocial] = useState(OBRAS_SOCIALES_ENTRE_RIOS[0]);
  const [busquedaPaciente, setBusquedaPaciente] = useState("");
  const [pacienteElegido, setPacienteElegido] = useState(null);
  const [profesionalId, setProfesionalId] = useState("");
  const [prestacionesDisponibles, setPrestacionesDisponibles] = useState([]);
  const [itemId, setItemId] = useState("");
  const [prestacion, setPrestacion] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [valorOS, setValorOS] = useState("");
  const [categoria, setCategoria] = useState("Común");
  const [dni, setDni] = useState("");
  const [numeroAfiliado, setNumeroAfiliado] = useState("");
  const [sinHonorarios, setSinHonorarios] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    obtenerPrestacionesObraSocial(obraSocial).then(setPrestacionesDisponibles);
    setItemId("");
    setPrestacion("");
    setCodigo("");
    setValorOS("");
    setCategoria("Común");
  }, [obraSocial]);

  const coincidenciasPaciente =
    !pacienteElegido && busquedaPaciente.trim().length >= 2
      ? pacientes
          .filter((p) => (p.apellido_y_nombre || "").toLowerCase().includes(busquedaPaciente.trim().toLowerCase()))
          .slice(0, 8)
      : [];

  function elegirItem(id) {
    setItemId(id);
    const item = prestacionesDisponibles.find((p) => p.id === id);
    if (!item) return;
    setPrestacion(item.prestacion_os);
    setCodigo(item.codigo || "");
    setValorOS(String(item.valor_os || ""));
    setCategoria(item.categoria || "Común");
  }

  async function guardar() {
    setError(null);
    if (!pacienteElegido) {
      setError("Elegí un paciente.");
      return;
    }
    if (!prestacion.trim()) {
      setError("Completá la prestación.");
      return;
    }
    setGuardando(true);
    try {
      await crearFichaEntreRiosManual({
        fecha,
        pacienteId: pacienteElegido.id,
        dni: dni.trim() || pacienteElegido.dni || null,
        obraSocial,
        numeroAfiliado: numeroAfiliado.trim(),
        profesionalId: profesionalId || null,
        prestacion: prestacion.trim(),
        codigo: codigo.trim(),
        cantidad: Number(cantidad) || 1,
        valorOS: Number(valorOS) || 0,
        sinHonorarios,
        categoria,
        observaciones: observaciones.trim(),
      });
      onGuardado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">Nueva ficha — Entre Ríos</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          Para cargar a mano una atención que ya se hizo (y ya se cobró el coseguro) pero todavía no tiene ficha acá.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Fecha
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Obra social
              <select
                value={obraSocial}
                onChange={(e) => setObraSocial(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                {OBRAS_SOCIALES_ENTRE_RIOS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Paciente
            {pacienteElegido ? (
              <div className="flex items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
                <span className="font-medium text-gray-900">{pacienteElegido.apellido_y_nombre}</span>
                <button
                  type="button"
                  onClick={() => setPacienteElegido(null)}
                  className="text-xs text-brand-brown hover:underline"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <input
                  value={busquedaPaciente}
                  onChange={(e) => setBusquedaPaciente(e.target.value)}
                  placeholder="Buscar por nombre..."
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {coincidenciasPaciente.length > 0 && (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-gray-200">
                    {coincidenciasPaciente.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPacienteElegido(p);
                            setBusquedaPaciente("");
                            setDni(p.dni || "");
                            setNumeroAfiliado(p.numero_afiliado || "");
                          }}
                          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                        >
                          {p.apellido_y_nombre}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </label>

          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Profesional
            <select
              value={profesionalId}
              onChange={(e) => setProfesionalId(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">(sin especificar)</option>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Prestación (del nomenclador de {obraSocial}, opcional)
            <select
              value={itemId}
              onChange={(e) => elegirItem(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">(elegir de la lista)</option>
              {prestacionesDisponibles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.prestacion_os} {p.codigo ? `(${p.codigo})` : ""} — ${Number(p.valor_os).toLocaleString("es-AR")}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Prestación
              <input
                value={prestacion}
                onChange={(e) => setPrestacion(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Código
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Cantidad
              <input
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Valor OS
              <input
                type="number"
                min={0}
                value={valorOS}
                onChange={(e) => setValorOS(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Categoría
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="Común">Común</option>
                <option value="Prótesis">Prótesis</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              DNI
              <input
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              N° Afiliado
              <input
                value={numeroAfiliado}
                onChange={(e) => setNumeroAfiliado(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={sinHonorarios} onChange={(e) => setSinHonorarios(e.target.checked)} />
            No corresponde honorarios (administrativo)
          </label>

          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Observaciones
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar ficha"}
          </button>
        </div>
      </div>
    </div>
  );
}
