"use client";

import { useEffect, useMemo, useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obraDelNomenclador, obtenerPrestacionesDeObra } from "@/lib/data/autorizacionesObraSocial";

function tieneObraSocial(p) {
  return !!p.obra_social;
}

function etiquetaPrestacion(p) {
  return `${p.prestacion_os}${p.codigo ? ` (${p.codigo})` : ""}`;
}

export default function AutorizacionFormModal({ autorizacion, pacientes, obrasNomenclador, onClose, onGuardar }) {
  const [pacienteElegido, setPacienteElegido] = useState(
    autorizacion ? { id: autorizacion.pacienteId, apellido_y_nombre: autorizacion.pacienteNombre } : null
  );
  const [busqueda, setBusqueda] = useState("");
  const [listaAbierta, setListaAbierta] = useState(false);
  const [soloConObraSocial, setSoloConObraSocial] = useState(true);
  const [obraSocial, setObraSocial] = useState(autorizacion?.obraSocial || "");
  const [numeroAfiliado, setNumeroAfiliado] = useState(autorizacion?.numeroAfiliado || "");
  const [prestacion, setPrestacion] = useState(autorizacion?.prestacion || "");
  const [estado, setEstado] = useState(autorizacion?.estado || "Para autorizar");
  const [fechaPedido, setFechaPedido] = useState(autorizacion?.fechaPedido || fechaDeHoyISO());
  const [fechaEnvio, setFechaEnvio] = useState(autorizacion?.fechaEnvio || "");
  const [fechaAutorizacion, setFechaAutorizacion] = useState(autorizacion?.fechaAutorizacion || "");
  const [numeroAutorizacion, setNumeroAutorizacion] = useState(autorizacion?.numeroAutorizacion || "");
  const [observaciones, setObservaciones] = useState(autorizacion?.observaciones || "");
  const [cargadas, setCargadas] = useState({ obra: null, lista: [] });
  const [busquedaPrestacion, setBusquedaPrestacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const obraEnNomenclador = useMemo(
    () => obraDelNomenclador(obraSocial, obrasNomenclador),
    [obraSocial, obrasNomenclador]
  );

  useEffect(() => {
    if (!obraEnNomenclador) return;
    let vigente = true;
    obtenerPrestacionesDeObra(obraEnNomenclador)
      .then((lista) => vigente && setCargadas({ obra: obraEnNomenclador, lista }))
      .catch(() => vigente && setCargadas({ obra: obraEnNomenclador, lista: [] }));
    return () => {
      vigente = false;
    };
  }, [obraEnNomenclador]);

  const prestacionesDeObra = obraEnNomenclador && cargadas.obra === obraEnNomenclador ? cargadas.lista : [];

  const coincidencias = useMemo(() => {
    if (pacienteElegido) return [];
    const q = busqueda.trim().toLowerCase();
    return pacientes
      .filter((p) => (soloConObraSocial ? tieneObraSocial(p) : true))
      .filter(
        (p) => !q || (p.apellido_y_nombre || "").toLowerCase().includes(q) || (p.dni || "").includes(q)
      )
      .slice(0, 8);
  }, [pacientes, pacienteElegido, busqueda, soloConObraSocial]);

  function elegirPaciente(p) {
    setPacienteElegido(p);
    setBusqueda("");
    setListaAbierta(false);
    if (p.obra_social) setObraSocial(obraDelNomenclador(p.obra_social, obrasNomenclador) || p.obra_social);
    if (p.numero_afiliado) setNumeroAfiliado(p.numero_afiliado);
  }

  function agregarPrestacion(texto) {
    const item = prestacionesDeObra.find((p) => etiquetaPrestacion(p) === texto);
    if (!item) {
      setBusquedaPrestacion(texto);
      return;
    }
    setPrestacion((actual) => (actual.trim() ? `${actual.trim()}\n${texto}` : texto));
    setBusquedaPrestacion("");
  }

  async function guardar() {
    setError(null);
    if (!pacienteElegido) return setError("Elegí un paciente.");
    if (!obraSocial.trim()) return setError("Completá la obra social.");
    if (!prestacion.trim()) return setError("Completá qué se pide autorizar.");
    setGuardando(true);
    try {
      const hoy = fechaDeHoyISO();
      await onGuardar({
        pacienteId: pacienteElegido.id,
        obraSocial,
        numeroAfiliado,
        prestacion,
        estado,
        fechaPedido,
        fechaEnvio: estado === "Para autorizar" ? null : fechaEnvio || hoy,
        fechaAutorizacion: estado === "Autorizada" ? fechaAutorizacion || hoy : null,
        numeroAutorizacion,
        observaciones,
      });
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">
            {autorizacion ? "Editar autorización" : "Nueva ficha para autorizar"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 text-xs text-gray-700">
            Paciente
            {pacienteElegido ? (
              <div className="flex items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
                <span className="font-medium text-gray-900">{pacienteElegido.apellido_y_nombre}</span>
                {!autorizacion && (
                  <button
                    type="button"
                    onClick={() => setPacienteElegido(null)}
                    className="text-xs text-brand-brown hover:underline"
                  >
                    Cambiar
                  </button>
                )}
              </div>
            ) : (
              <>
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onFocus={() => setListaAbierta(true)}
                  placeholder="Tocá para ver la lista o escribí nombre o DNI..."
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <input
                    type="checkbox"
                    checked={soloConObraSocial}
                    onChange={(e) => setSoloConObraSocial(e.target.checked)}
                  />
                  Mostrar solo pacientes con obra social
                </label>
                {(listaAbierta || busqueda.trim()) &&
                  (coincidencias.length > 0 ? (
                    <ul className="max-h-48 overflow-y-auto rounded-md border border-gray-200">
                      {coincidencias.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => elegirPaciente(p)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                          >
                            <span>{p.apellido_y_nombre}</span>
                            {p.obra_social && (
                              <span className="text-xs text-gray-400">
                                {p.obra_social}
                                {p.obraSocialDeAgenda ? " (según agenda)" : ""}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-400">
                      No hay pacientes con ese dato{soloConObraSocial ? " (probá destildar el filtro de obra social)" : ""}.
                    </p>
                  ))}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Obra social
              <input
                value={obraSocial}
                onChange={(e) => setObraSocial(e.target.value)}
                list="autorizaciones-obras-sociales"
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <datalist id="autorizaciones-obras-sociales">
                {obrasNomenclador.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              N° de afiliado
              <input
                value={numeroAfiliado}
                onChange={(e) => setNumeroAfiliado(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1 text-xs text-gray-700">
            Qué se pide autorizar
            {obraEnNomenclador ? (
              <>
                <input
                  value={busquedaPrestacion}
                  onChange={(e) => agregarPrestacion(e.target.value)}
                  list="autorizaciones-prestaciones"
                  placeholder={`Buscar prestación de ${obraEnNomenclador} y elegirla para agregarla...`}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <datalist id="autorizaciones-prestaciones">
                  {prestacionesDeObra.map((p) => (
                    <option key={p.id} value={etiquetaPrestacion(p)} />
                  ))}
                </datalist>
              </>
            ) : (
              obraSocial.trim() && (
                <p className="text-[11px] text-amber-700">
                  Esta obra social no está en el nomenclador: escribí la prestación a mano, o elegí otra obra social de
                  la lista.
                </p>
              )
            )}
            <textarea
              value={prestacion}
              onChange={(e) => setPrestacion(e.target.value)}
              rows={3}
              placeholder="Las prestaciones que elijas aparecen acá (una por línea). También podés escribir o corregir a mano."
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Estado
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="Para autorizar">Para autorizar</option>
                <option value="Enviada">Enviada a autorizar</option>
                <option value="Autorizada">Autorizada</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Fecha del pedido
              <input
                type="date"
                value={fechaPedido}
                onChange={(e) => setFechaPedido(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          {estado !== "Para autorizar" && (
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Fecha de envío a la obra social
              <input
                type="date"
                value={fechaEnvio || fechaDeHoyISO()}
                onChange={(e) => setFechaEnvio(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          )}

          {estado === "Autorizada" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-gray-700">
                N° de autorización
                <input
                  value={numeroAutorizacion}
                  onChange={(e) => setNumeroAutorizacion(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-700">
                Fecha de autorización
                <input
                  type="date"
                  value={fechaAutorizacion || fechaDeHoyISO()}
                  onChange={(e) => setFechaAutorizacion(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
          )}

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
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
