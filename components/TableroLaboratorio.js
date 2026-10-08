"use client";

import { useState } from "react";
import { COLOR_SEMAFORO, ETAPAS, calcularCircuito } from "@/lib/circuitoLaboratorio";
import { claveTurnoTrabajo, registrarPasoCircuito } from "@/lib/data/laboratorio";
import { fechaDeHoyISO } from "@/lib/agenda";

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

// Botones de cada etapa: lo que se hace con UN toque para avanzar el trabajo.
// `tipos` son los eventos que se cargan (en orden) con la fecha de hoy.
function accionesDe(etapa) {
  switch (etapa) {
    case "pendiente_envio":
      return [{ clave: "enviar", texto: "📤 Enviar al mecánico", especial: "enviar" }];
    case "en_mecanico":
      return [{ clave: "llego", texto: "📥 Llegó del mecánico", tipos: ["Recibido del mecánico"] }];
    case "en_clinica":
      return [
        { clave: "ajustar", texto: "🔧 Probó: hay que ajustar", tipos: ["Prueba con el paciente", "Ajuste - reenviado"], prueba: true },
        { clave: "ok", texto: "👍 Probó: está bien", tipos: ["Prueba con el paciente", "Prueba aprobada"], prueba: true },
        {
          clave: "ok_entrega",
          texto: "🎁 Probó: está bien y se entrega hoy",
          tipos: ["Prueba con el paciente", "Prueba aprobada", "Alta / Entregado"],
          prueba: true,
        },
        { clave: "directo", texto: "🎁 Entregar sin prueba", tipos: ["Alta / Entregado"], suave: true },
      ];
    case "probado":
      return [
        { clave: "ajustar", texto: "🔧 Hay que ajustar", tipos: ["Ajuste - reenviado"] },
        { clave: "ok", texto: "👍 Está bien", tipos: ["Prueba aprobada"] },
        { clave: "ok_entrega", texto: "🎁 Está bien y se entrega hoy", tipos: ["Prueba aprobada", "Alta / Entregado"] },
      ];
    case "listo":
      return [{ clave: "entregar", texto: "🎁 Entregado al paciente", tipos: ["Alta / Entregado"] }];
    default:
      return [];
  }
}

const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function textoTurno(turno) {
  const [anio, mes, dia] = turno.fecha.split("-").map(Number);
  const semana = DIAS_SEMANA[new Date(anio, mes - 1, dia).getDay()];
  return `${semana} ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}${turno.hora ? ` · ${turno.hora}` : ""}`;
}

function diasHasta(fechaISO) {
  const hoy = new Date(fechaDeHoyISO() + "T12:00:00");
  return Math.round((new Date(fechaISO + "T12:00:00") - hoy) / (1000 * 60 * 60 * 24));
}

function Tarjeta({ trabajo, circuito, turno, ocupado, onAbrir, onAccion }) {
  const sem = COLOR_SEMAFORO[circuito.semaforo];
  const acciones = accionesDe(circuito.etapa);
  return (
    <div
      onClick={onAbrir}
      className="cursor-pointer rounded-md border border-gray-200 bg-white p-2.5 shadow-sm hover:border-brand-brown/50"
    >
      <p className="text-sm font-semibold text-gray-900">{trabajo.pacienteNombre}</p>
      <p className="text-xs text-gray-600">
        {trabajo.tipoTrabajo}
        {trabajo.pieza ? ` (${trabajo.pieza})` : ""}
      </p>
      <p className="mt-0.5 text-[11px] text-gray-500">
        {trabajo.laboratorio || "Sin mecánico"} · {trabajo.profesional}
        {trabajo.valor ? ` · ${formatoPesos(trabajo.valor)}` : ""}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">{circuito.vuelta || "—"}</span>
        <span className={`text-[11px] font-medium ${sem.clase}`}>
          {sem.emoji} {circuito.dias} día{circuito.dias === 1 ? "" : "s"}
        </span>
      </div>
      {circuito.etapa === "en_clinica" &&
        (turno ? (
          <p className="mt-1 text-[11px] font-medium text-emerald-700">📅 Ya tiene turno: {textoTurno(turno)}</p>
        ) : (
          <p className="mt-1 text-[11px] font-medium text-amber-800">📅 Falta dar turno de prueba</p>
        ))}
      {circuito.etapa === "en_mecanico" && turno && (
        <p
          className={`mt-1 text-[11px] font-medium ${diasHasta(turno.fecha) <= 3 ? "text-red-700" : "text-gray-600"}`}
        >
          📅 Turno: {textoTurno(turno)} — tiene que volver antes
        </p>
      )}
      {(circuito.etapa === "probado" || circuito.etapa === "listo") && turno && (
        <p className="mt-1 text-[11px] font-medium text-gray-600">📅 Próximo turno: {textoTurno(turno)}</p>
      )}
      {acciones.length > 0 && (
        <div className="mt-2 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
          {acciones.map((a) => (
            <button
              key={a.clave}
              type="button"
              disabled={ocupado}
              onClick={() => onAccion(trabajo, circuito, a)}
              className={`rounded-md px-2 py-1 text-left text-[11px] font-medium disabled:opacity-50 ${
                a.suave
                  ? "border border-gray-200 text-gray-500 hover:bg-gray-50"
                  : "border border-brand-brown/40 text-brand-brown hover:bg-brand-tan/30"
              }`}
            >
              {a.texto}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TableroLaboratorio({
  trabajos,
  eventosPorTrabajo,
  turnosPorPaciente = {},
  onAbrirTrabajo,
  onMarcarEnviado,
  onCambio,
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [filtroMecanico, setFiltroMecanico] = useState("");

  const activos = trabajos.filter((t) => t.estado !== "Entregado");
  const mecanicos = [...new Set(activos.map((t) => t.laboratorio || "Sin mecánico"))].sort((a, b) => a.localeCompare(b, "es"));
  const visibles = activos.filter((t) => !filtroMecanico || (t.laboratorio || "Sin mecánico") === filtroMecanico);

  const conCircuito = visibles.map((t) => ({ trabajo: t, circuito: calcularCircuito(t, eventosPorTrabajo[t.id] || []) }));

  async function ejecutarAccion(trabajo, circuito, accion) {
    if (accion.especial === "enviar") {
      onMarcarEnviado(trabajo);
      return;
    }
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      await registrarPasoCircuito(trabajo.id, accion.tipos);
      // Mario cobra la mitad al probar y la otra mitad al entregar: se le recuerda a
      // quien lo carga (si se prueba y se entrega el mismo día, le toca el 100%).
      if ((trabajo.laboratorio || "").trim().toLowerCase() === "mario" && trabajo.valor) {
        const entrega = accion.tipos.includes("Alta / Entregado");
        const prueba = accion.tipos.includes("Prueba con el paciente");
        let texto = null;
        if (prueba && entrega) {
          texto = `a Mario le corresponde el 100% de este trabajo (${formatoPesos(trabajo.valor)})`;
        } else if (prueba) {
          texto = `a Mario le corresponde el 50% de este trabajo al probarlo (${formatoPesos(trabajo.valor / 2)})`;
        } else if (entrega) {
          texto =
            circuito.pruebas > 0
              ? `al entregarlo, a Mario le corresponde el 50% restante (${formatoPesos(trabajo.valor / 2)})`
              : `a Mario le corresponde el 100% de este trabajo (${formatoPesos(trabajo.valor)})`;
        }
        if (texto) setAviso(`Recordá: ${texto} — ${trabajo.pacienteNombre}.`);
      }
      await onCambio();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select
          value={filtroMecanico}
          onChange={(e) => setFiltroMecanico(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">Todos los mecánicos</option>
          {mecanicos.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500">
          Cada trabajo está en una sola etapa. Tocá un botón para pasarlo a la siguiente; tocá la tarjeta para ver todo el historial.
        </span>
      </div>

      {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {aviso && (
        <div className="mt-3 flex items-start justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>💰 {aviso}</span>
          <button onClick={() => setAviso(null)} className="text-amber-700 hover:underline">
            Cerrar
          </button>
        </div>
      )}

      <div className="mt-4 grid gap-3 overflow-x-auto pb-3" style={{ gridTemplateColumns: "repeat(5, minmax(12rem, 1fr))" }}>
        {ETAPAS.map((etapa) => {
          const items = conCircuito
            .filter((x) => x.circuito.etapa === etapa.id)
            .sort((a, b) => b.circuito.dias - a.circuito.dias);
          return (
            <section
              key={etapa.id}
              className={`min-w-0 rounded-lg border ${etapa.colorBorde} ${etapa.colorFondo} p-2`}
            >
              <h2 className="flex items-baseline justify-between text-sm font-bold text-gray-900">
                <span>{etapa.titulo}</span>
                <span className="rounded-full bg-white px-2 text-xs font-semibold text-gray-700">{items.length}</span>
              </h2>
              <p className="mb-2 text-[11px] text-gray-500">{etapa.ayuda}</p>
              <div className="flex flex-col gap-2">
                {items.length === 0 ? (
                  <p className="py-3 text-center text-xs text-gray-400">Nada por acá</p>
                ) : (
                  items.map(({ trabajo, circuito }) => (
                    <Tarjeta
                      key={trabajo.id}
                      trabajo={trabajo}
                      circuito={circuito}
                      turno={turnosPorPaciente[claveTurnoTrabajo(trabajo)]}
                      ocupado={ocupado}
                      onAbrir={() => onAbrirTrabajo(trabajo)}
                      onAccion={ejecutarAccion}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
