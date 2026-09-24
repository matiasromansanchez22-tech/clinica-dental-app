"use client";

import { useEffect, useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { marcarEstadoDiente, marcarProtesis, obtenerOdontograma } from "@/lib/data/odontograma";
import { obtenerHistorialOdontograma } from "@/lib/data/historialClinicoGeneral";

// Numeración FDI (2 dígitos), dentición permanente — de momento no incluye
// dientes de leche. El orden de cada fila es el de un odontograma
// tradicional: arcada superior arriba (de derecha a izquierda del
// paciente), inferior abajo, con el medio de la boca al centro.
const PIEZAS_SUPERIOR = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"];
const PIEZAS_INFERIOR = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"];

// Convención de colores: azul = falta hacerlo, rojo = ya está hecho. Sano
// es la excepción (verde) — no es un "a realizar/hecho", es una
// confirmación de que se revisó y no tiene nada.
//
// Caries/Obturado/Sellante/Fracturado son por cara del diente. El resto es
// del diente completo (o, para la prótesis, de varios dientes seguidos).
const ESTADOS_CARA = ["(sin marcar)", "Sano", "Caries", "Obturado", "Sellante", "Fracturado"];
const ESTADOS_GENERAL = [
  "(sin marcar)",
  "Ausente",
  "A extraer",
  "Corona a realizar",
  "Corona realizada",
  "Conducto a realizar",
  "Conducto realizado",
  "Implante",
];
const ESTADOS_PROTESIS = ["(sin marcar)", "A realizar", "Realizada"];

const COLOR_CARA = {
  Sano: "bg-green-500",
  Caries: "bg-blue-500",
  Obturado: "bg-red-500",
  Sellante: "bg-cyan-400",
  Fracturado: "bg-amber-500",
};

// Ausente/A extraer y Corona son un ícono con borde; Conducto pinta todo el
// diente (como pidió Matías: "todo pintado").
const ESTILO_GENERAL = {
  Ausente: "border-red-500 bg-white text-red-600",
  "A extraer": "border-blue-500 bg-white text-blue-600",
  "Corona a realizar": "border-blue-500 bg-white text-blue-600",
  "Corona realizada": "border-red-500 bg-white text-red-600",
  "Conducto a realizar": "border-blue-500 bg-blue-500 text-white",
  "Conducto realizado": "border-red-500 bg-red-500 text-white",
  Implante: "border-teal-500 bg-teal-50 text-teal-700",
};

const ETIQUETA_GENERAL = {
  Ausente: "✕",
  "A extraer": "✕",
  "Corona a realizar": "○",
  "Corona realizada": "○",
  "Conducto a realizar": "TC",
  "Conducto realizado": "TC",
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

// Barra fina arriba de las piezas que forman parte de un puente — junta en
// un solo "corchete" las corridas de dientes seguidos con el mismo estado
// (a realizar / realizada), calculado a partir de qué piezas tienen la
// cara especial "protesis" marcada.
function FilaProtesis({ piezas, estadoPorPieza }) {
  const segmentos = [];
  let actual = null;
  piezas.forEach((pieza, i) => {
    const estado = estadoPorPieza[pieza]?.protesis;
    if (estado && actual && actual.estado === estado && actual.fin === i - 1) {
      actual.fin = i;
    } else {
      if (actual) segmentos.push(actual);
      actual = estado ? { inicio: i, fin: i, estado } : null;
    }
  });
  if (actual) segmentos.push(actual);

  return (
    <div className="mb-1 grid h-2" style={{ gridTemplateColumns: `repeat(${piezas.length}, 2rem)`, gap: "0.25rem" }}>
      {segmentos.map((s, i) => (
        <div
          key={i}
          title={`Prótesis ${s.estado === "Realizada" ? "realizada" : "a realizar"}`}
          className={`h-2 rounded-full ${s.estado === "Realizada" ? "bg-red-500" : "bg-blue-500"}`}
          style={{ gridColumn: `${s.inicio + 1} / ${s.fin + 2}` }}
        />
      ))}
    </div>
  );
}

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
    const estado = estados[cara] || "";
    const activo = seleccion?.pieza === pieza && seleccion?.cara === cara;
    return (
      <button
        type="button"
        onClick={() => onClick(pieza, cara)}
        title={`Diente ${pieza} — ${ETIQUETA_CARA[cara]}: ${estado || "sin revisar"}`}
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

// Odontograma de Sistema General. Vive en la ficha del paciente y en la
// Agenda. Se carga desde el formulario de abajo (pieza/cara/qué se va a
// hacer, o prótesis con "desde"/"hasta"), o tocando directo el diagrama —
// las dos formas cargan lo mismo en el formulario para poder ajustarlo
// antes de guardar. Cada cambio queda anotado con fecha y profesional en
// su propio historial (más abajo, desplegable) — separado del historial
// clínico de la ficha, que queda libre para anotar cómo viene el plan de
// tratamiento sin mezclarse con el detalle diente por diente.
export default function Odontograma({ pacienteId, profesionales, onCambio }) {
  const [estadoPorPieza, setEstadoPorPieza] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [profesionalId, setProfesionalId] = useState("");
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [guardando, setGuardando] = useState(false);
  const [modoForm, setModoForm] = useState("diente");
  const [piezaForm, setPiezaForm] = useState("");
  const [caraForm, setCaraForm] = useState("");
  const [estadoForm, setEstadoForm] = useState("");
  const [piezaDesdeForm, setPiezaDesdeForm] = useState("");
  const [piezaHastaForm, setPiezaHastaForm] = useState("");
  const [estadoProtesisForm, setEstadoProtesisForm] = useState("");
  const [historialOdonto, setHistorialOdonto] = useState([]);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const [filas, historial] = await Promise.all([
        obtenerOdontograma(pacienteId),
        obtenerHistorialOdontograma(pacienteId),
      ]);
      const mapa = {};
      for (const f of filas) {
        if (!mapa[f.pieza]) mapa[f.pieza] = {};
        mapa[f.pieza][f.cara] = f.estado;
      }
      setEstadoPorPieza(mapa);
      setHistorialOdonto(historial);
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
    setModoForm("diente");
    setPiezaForm(pieza);
    setCaraForm(cara);
    setEstadoForm(estadoPorPieza[pieza]?.[cara] || "(sin marcar)");
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

  async function guardarProtesis() {
    if (!piezaDesdeForm || !piezaHastaForm || !estadoProtesisForm) return;
    setGuardando(true);
    setError(null);
    try {
      await marcarProtesis({
        pacienteId,
        piezaDesde: piezaDesdeForm,
        piezaHasta: piezaHastaForm,
        estado: estadoProtesisForm,
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

  // Si todavía no eligieron cara, se completa sola en "Diente completo" —
  // lo mismo que pasa si tocás el número del diente en el dibujo — así el
  // desplegable de "Qué se va a hacer" (que necesita saber la cara para
  // mostrar las opciones correctas) queda disponible enseguida en vez de
  // quedar gris sin que se note por qué.
  function cambiarPieza(nuevaPieza) {
    setPiezaForm(nuevaPieza);
    const cara = caraForm || "general";
    setCaraForm(cara);
    setEstadoForm(estadoPorPieza[nuevaPieza]?.[cara] || "(sin marcar)");
  }

  function cambiarCara(nuevaCara) {
    setCaraForm(nuevaCara);
    if (piezaForm) setEstadoForm(estadoPorPieza[piezaForm]?.[nuevaCara] || "(sin marcar)");
  }

  const seleccion = piezaForm && caraForm ? { pieza: piezaForm, cara: caraForm } : null;
  const todasLasPiezas = [...PIEZAS_SUPERIOR, ...PIEZAS_INFERIOR];

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
          <FilaProtesis piezas={PIEZAS_SUPERIOR} estadoPorPieza={estadoPorPieza} />
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
          <FilaProtesis piezas={PIEZAS_INFERIOR} estadoPorPieza={estadoPorPieza} />
        </div>
      )}

      <div className="mt-3 rounded-md border border-brand-brown/40 bg-brand-tan/20 p-3">
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => setModoForm("diente")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              modoForm === "diente" ? "bg-brand-brown text-white" : "border border-gray-300 bg-white text-gray-700"
            }`}
          >
            Diente / cara
          </button>
          <button
            type="button"
            onClick={() => setModoForm("protesis")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              modoForm === "protesis" ? "bg-brand-brown text-white" : "border border-gray-300 bg-white text-gray-700"
            }`}
          >
            Prótesis (puente)
          </button>
        </div>

        {modoForm === "diente" ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-xs text-gray-700">
                Pieza
                <select
                  value={piezaForm}
                  onChange={(e) => cambiarPieza(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Elegir...</option>
                  {todasLasPiezas.map((p) => (
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
          </>
        ) : (
          <>
            <p className="mb-2 text-[11px] text-gray-500">
              Elegí el primer y el último diente que cubre el puente (de la misma arcada) — se pinta un corchete
              arriba de todos los que quedan en el medio.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-xs text-gray-700">
                Desde
                <select
                  value={piezaDesdeForm}
                  onChange={(e) => setPiezaDesdeForm(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Elegir...</option>
                  {todasLasPiezas.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-700">
                Hasta
                <select
                  value={piezaHastaForm}
                  onChange={(e) => setPiezaHastaForm(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Elegir...</option>
                  {todasLasPiezas.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-700">
                Estado
                <select
                  value={estadoProtesisForm}
                  onChange={(e) => setEstadoProtesisForm(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Elegir...</option>
                  {ESTADOS_PROTESIS.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={guardarProtesis}
              disabled={!piezaDesdeForm || !piezaHastaForm || !estadoProtesisForm || guardando}
              className="mt-2 w-full rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar en el odontograma"}
            </button>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-green-500" /> Sano
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Caries
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Obturado
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-cyan-400" /> Sellante
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Fracturado
        </span>
        <span className="flex items-center gap-1">
          <span className="flex h-2.5 w-2.5 items-center justify-center rounded-sm border-2 border-red-500 text-[7px] text-red-600">
            ✕
          </span>{" "}
          Ausente
        </span>
        <span className="flex items-center gap-1">
          <span className="flex h-2.5 w-2.5 items-center justify-center rounded-sm border-2 border-blue-500 text-[7px] text-blue-600">
            ✕
          </span>{" "}
          A extraer
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-blue-500" /> Corona a realizar
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-red-500" /> Corona realizada
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Conducto (TC) a realizar
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Conducto (TC) realizado
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm border-2 border-teal-500 bg-teal-50" /> Implante
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-3.5 rounded-full bg-blue-500" /> Prótesis a realizar
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-3.5 rounded-full bg-red-500" /> Prótesis realizada
        </span>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        Azul = falta hacerlo, rojo = ya está hecho (sano es la excepción: verde). Un diente en blanco todavía no se
        revisó. Elegí pieza, cara y qué se va a hacer en el formulario de arriba (o "Prótesis" para un puente), o
        tocá directo el diagrama — las dos formas cargan lo mismo y podés ajustarlo antes de guardar.
      </p>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setMostrarHistorial((v) => !v)}
          className="text-[11px] font-medium text-brand-brown hover:underline"
        >
          {mostrarHistorial ? "▾" : "▸"} Historial de cambios del odontograma ({historialOdonto.length})
        </button>
        {mostrarHistorial && (
          <ul className="mt-1.5 flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-2">
            {historialOdonto.length === 0 ? (
              <li className="text-[11px] text-gray-400">Todavía no hay cambios cargados.</li>
            ) : (
              historialOdonto.map((h) => (
                <li key={h.id} className="text-[11px] text-gray-600">
                  <span className="font-medium text-gray-700">{h.fecha}</span>
                  {h.profesional ? ` — ${h.profesional}` : ""} — {h.nota}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
