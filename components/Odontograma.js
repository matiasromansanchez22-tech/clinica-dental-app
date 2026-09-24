"use client";

import { useEffect, useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { marcarEstadoDiente, obtenerOdontograma } from "@/lib/data/odontograma";

// Numeración FDI (2 dígitos), dentición permanente — de momento no incluye
// dientes de leche. El orden de cada fila es el de un odontograma
// tradicional: arcada superior arriba (de derecha a izquierda del
// paciente), inferior abajo, con el medio de la boca al centro.
const PIEZAS_SUPERIOR = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"];
const PIEZAS_INFERIOR = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"];

// Caries/Obturado/etc. son por cara del diente. Ausente/Corona/Conducto/
// Implante/A extraer son del diente completo — no tiene sentido marcarlos
// por cara, así que usan su propia "cara" especial: "general".
const ESTADOS_CARA = ["Sano", "Caries", "Obturado", "Sellante", "Fracturado"];
const ESTADOS_GENERAL = ["Sano", "Ausente", "A extraer", "Corona", "Conducto", "Implante"];

const COLOR_CARA = {
  Caries: "bg-red-500",
  Obturado: "bg-blue-500",
  Sellante: "bg-emerald-400",
  Fracturado: "bg-amber-500",
};

const ESTILO_GENERAL = {
  Ausente: "border-gray-400 bg-gray-200 text-gray-500",
  "A extraer": "border-red-500 bg-red-50 text-red-600",
  Corona: "border-amber-500 bg-amber-50 text-amber-700",
  Conducto: "border-violet-500 bg-violet-50 text-violet-700",
  Implante: "border-teal-500 bg-teal-50 text-teal-700",
};

const ETIQUETA_GENERAL = {
  Ausente: "✕",
  "A extraer": "Ext",
  Corona: "Cor",
  Conducto: "TC",
  Implante: "Imp",
};

const ETIQUETA_CARA = {
  vestibular: "Vestibular",
  mesial: "Mesial",
  distal: "Distal",
  oclusal: "Oclusal",
  palatino: "Palatino / Lingual",
  general: "Diente completo",
};

const CARAS_FORM = ["vestibular", "mesial", "distal", "oclusal", "palatino", "general"];

function Diente({ pieza, esInferior, estados, seleccion, onClick }) {
  const general = estados.general;

  if (general) {
    const activo = seleccion?.pieza === pieza && seleccion?.cara === "general";
    return (
      <div className="flex flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={() => onClick(pieza, "general")}
          title={`Diente ${pieza} — ${general}`}
          className={`flex h-8 w-8 items-center justify-center rounded border-2 text-[9px] font-semibold ${
            ESTILO_GENERAL[general]
          } ${activo ? "ring-2 ring-brand-brown" : ""}`}
        >
          {ETIQUETA_GENERAL[general]}
        </button>
        <span className="text-[9px] text-gray-500">{pieza}</span>
      </div>
    );
  }

  // En la arcada superior la cara "de afuera" (vestibular) va arriba y la
  // "de adentro" (palatino) abajo; en la inferior se invierte — así el
  // odontograma queda simétrico respecto de la línea entre las dos arcadas,
  // como en un odontograma de papel.
  const arriba = esInferior ? "palatino" : "vestibular";
  const abajo = esInferior ? "vestibular" : "palatino";

  function celda(cara, posicion) {
    const estado = estados[cara] || "Sano";
    const activo = seleccion?.pieza === pieza && seleccion?.cara === cara;
    return (
      <button
        type="button"
        onClick={() => onClick(pieza, cara)}
        title={`Diente ${pieza} — ${ETIQUETA_CARA[cara]}: ${estado}`}
        className={`h-full w-full ${posicion} ${COLOR_CARA[estado] || "bg-white"} ${
          activo ? "ring-2 ring-inset ring-brand-brown" : ""
        }`}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="grid h-8 w-8 grid-cols-3 grid-rows-3 gap-px rounded border border-gray-300 bg-gray-300 p-px">
        {celda(arriba, "col-start-2 row-start-1")}
        {celda("mesial", "col-start-1 row-start-2")}
        {celda("oclusal", "col-start-2 row-start-2")}
        {celda("distal", "col-start-3 row-start-2")}
        {celda(abajo, "col-start-2 row-start-3")}
      </div>
      <button
        type="button"
        onClick={() => onClick(pieza, "general")}
        className="text-[9px] text-gray-500 hover:text-brand-brown hover:underline"
      >
        {pieza}
      </button>
    </div>
  );
}

// Odontograma de Sistema General. Vive en la ficha del paciente. Cada click
// en una cara (o en el número, para el diente completo) abre una paleta
// abajo para elegir el estado — se guarda solo, sin botón de "Guardar"
// aparte, y a la vez deja una entrada en el historial clínico (más abajo en
// esta misma ficha) para que quede registrado con fecha y profesional.
export default function Odontograma({ pacienteId, profesionales, onCambio }) {
  const [estadoPorPieza, setEstadoPorPieza] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [profesionalId, setProfesionalId] = useState("");
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [guardando, setGuardando] = useState(false);
  const [piezaForm, setPiezaForm] = useState("");
  const [caraForm, setCaraForm] = useState("");
  const [estadoForm, setEstadoForm] = useState("");

  async function cargar() {
    setCargando(true);
    try {
      const filas = await obtenerOdontograma(pacienteId);
      const mapa = {};
      for (const f of filas) {
        if (!mapa[f.pieza]) mapa[f.pieza] = {};
        mapa[f.pieza][f.cara] = f.estado;
      }
      setEstadoPorPieza(mapa);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  // Tocar una cara (o el número) del diagrama carga esos mismos datos en el
  // formulario de abajo — con el estado actual ya elegido, para poder
  // cambiarlo rápido sin tener que adivinar qué tenía.
  function elegir(pieza, cara) {
    setPiezaForm(pieza);
    setCaraForm(cara);
    setEstadoForm((estadoPorPieza[pieza]?.[cara]) || "Sano");
  }

  async function guardarDesdeFormulario() {
    if (!piezaForm || !caraForm || !estadoForm) return;
    setGuardando(true);
    setError(null);
    try {
      await marcarEstadoDiente({
        pacienteId,
        pieza: piezaForm,
        cara: caraForm,
        estado: estadoForm,
        profesionalId: profesionalId || null,
        fecha,
      });
      await cargar();
      onCambio?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  const opcionesEstado = caraForm === "general" ? ESTADOS_GENERAL : ESTADOS_CARA;

  function cambiarPieza(nuevaPieza) {
    setPiezaForm(nuevaPieza);
    if (caraForm) setEstadoForm(estadoPorPieza[nuevaPieza]?.[caraForm] || "Sano");
  }

  function cambiarCara(nuevaCara) {
    setCaraForm(nuevaCara);
    if (piezaForm) setEstadoForm(estadoPorPieza[piezaForm]?.[nuevaCara] || "Sano");
  }

  const seleccion = piezaForm && caraForm ? { pieza: piezaForm, cara: caraForm } : null;

  return (
    <div>
      <hr className="mb-4 border-gray-200" />
      <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Odontograma</p>

      {error && <p className="mb-2 text-xs text-red-700">{error}</p>}

      <div className="mb-2 grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-gray-700">
          Fecha
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-700">
          Quién lo marca
          <select
            value={profesionalId}
            onChange={(e) => setProfesionalId(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">(sin especificar)</option>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {cargando ? (
        <p className="text-xs text-gray-500">Cargando odontograma...</p>
      ) : (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="flex justify-center gap-1 overflow-x-auto pb-2">
            {PIEZAS_SUPERIOR.map((pieza) => (
              <Diente
                key={pieza}
                pieza={pieza}
                esInferior={false}
                estados={estadoPorPieza[pieza] || {}}
                seleccion={seleccion}
                onClick={elegir}
              />
            ))}
          </div>
          <hr className="my-2 border-gray-300" />
          <div className="flex justify-center gap-1 overflow-x-auto pt-2">
            {PIEZAS_INFERIOR.map((pieza) => (
              <Diente
                key={pieza}
                pieza={pieza}
                esInferior={true}
                estados={estadoPorPieza[pieza] || {}}
                seleccion={seleccion}
                onClick={elegir}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 rounded-md border border-brand-brown/40 bg-brand-tan/20 p-3">
        <p className="mb-2 text-xs font-medium text-brand-brown">Elegir pieza, cara y qué se va a hacer</p>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Pieza
            <select
              value={piezaForm}
              onChange={(e) => cambiarPieza(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Elegir...</option>
              {[...PIEZAS_SUPERIOR, ...PIEZAS_INFERIOR].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Cara
            <select
              value={caraForm}
              onChange={(e) => cambiarCara(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Elegir...</option>
              {CARAS_FORM.map((c) => (
                <option key={c} value={c}>
                  {ETIQUETA_CARA[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Qué se va a hacer
            <select
              value={estadoForm}
              onChange={(e) => setEstadoForm(e.target.value)}
              disabled={!caraForm}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100"
            >
              <option value="">Elegir...</option>
              {opcionesEstado.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={guardarDesdeFormulario}
          disabled={!piezaForm || !caraForm || !estadoForm || guardando}
          className="mt-2 w-full rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar en el odontograma"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Caries
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Obturado
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Sellante
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Fracturado
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm border-2 border-gray-400 bg-gray-200" /> Ausente
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm border-2 border-red-500 bg-red-50" /> A extraer
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm border-2 border-amber-500 bg-amber-50" /> Corona
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm border-2 border-violet-500 bg-violet-50" /> Conducto (TC)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm border-2 border-teal-500 bg-teal-50" /> Implante
        </span>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        Elegí pieza, cara y qué se va a hacer en el formulario de arriba, o tocá directo una cara del diagrama (o el
        número, para el diente completo) — las dos formas cargan lo mismo y podés ajustarlo antes de guardar. Cada
        cambio queda anotado solo, con fecha y profesional, en el historial clínico de abajo.
      </p>
    </div>
  );
}
