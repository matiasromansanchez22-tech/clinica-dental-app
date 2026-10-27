"use client";

import { useEffect, useState } from "react";
import { obtenerFidelidadDePaciente } from "@/lib/data/fidelidad";

const formatoFecha = (f) => (f ? f.split("-").reverse().join("/") : "—");

// Casillas de la tarjeta: las visitas ya hechas van llenas; la 5.ª lleva "50%" y la 10.ª "Gratis".
export function CasillasTarjeta({ progreso, cfg, completa = false }) {
  const total = cfg.fidelidad_visitas_control_gratis;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const llena = completa || n <= progreso;
        const etiqueta = n === cfg.fidelidad_visitas_descuento ? `${cfg.fidelidad_porcentaje_descuento}%` : n === total ? "Gratis" : null;
        return (
          <span
            key={n}
            title={etiqueta ? `Visita ${n}: ${etiqueta === "Gratis" ? "control sin costo" : `${etiqueta} de descuento`}` : `Visita ${n}`}
            className={`flex h-6 min-w-6 items-center justify-center rounded-full border px-1 text-[10px] font-bold ${
              llena ? "border-amber-600 bg-amber-500 text-white" : etiqueta ? "border-amber-500 bg-white text-amber-700" : "border-gray-300 bg-white text-gray-400"
            }`}
          >
            {etiqueta || (llena ? "✓" : n)}
          </span>
        );
      })}
    </div>
  );
}

// Tarjeta de fidelidad en la ficha de un paciente de Ortodoncia: cuántas visitas seguidas lleva y qué premios tiene.
export default function FidelidadPacienteCampo({ pacienteId }) {
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    if (!pacienteId) return;
    obtenerFidelidadDePaciente(pacienteId)
      .then(setDatos)
      .catch(() => {});
  }, [pacienteId]);

  if (!pacienteId || !datos) return null;
  const { cfg, racha, premios } = datos;
  const habilitados = premios.filter((p) => p.estado === "Habilitado" && !p.roto);
  const perdidos = premios.filter((p) => p.estado === "Habilitado" && p.roto);
  const usados = premios.filter((p) => p.estado === "Aplicado");

  return (
    <div className="col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <p className="text-xs font-semibold uppercase text-amber-700">🎟️ Tarjeta de fidelidad</p>
      <p className="mt-1">
        {racha.completoUltima
          ? `Completó la tarjeta (${cfg.fidelidad_visitas_control_gratis} visitas seguidas). Empieza una nueva.`
          : `Lleva ${racha.progreso} de ${cfg.fidelidad_visitas_control_gratis} visitas seguidas${racha.ultimaVisita ? ` · última: ${formatoFecha(racha.ultimaVisita)}` : ""}.`}
      </p>
      <div className="mt-1.5">
        <CasillasTarjeta progreso={racha.progreso} cfg={cfg} completa={racha.completoUltima} />
      </div>
      {habilitados.map((p) => (
        <p key={p.id} className="mt-1.5 text-xs font-medium">
          🎁 {p.ganadoEn ? `Premio de su visita ${p.nivel}` : `En su próxima visita (la ${p.nivel}.ª)`}:{" "}
          {p.tipo === "Control sin costo" ? "control sin costo" : `${cfg.fidelidad_porcentaje_descuento}% de descuento en el control`} (hasta el {formatoFecha(p.vence)}).
        </p>
      ))}
      {perdidos.map((p) => (
        <p key={p.id} className="mt-1 text-xs text-red-700">
          Perdió el premio de la visita {p.nivel} porque faltó sin avisar.
        </p>
      ))}
      {usados.length > 0 && <p className="mt-1 text-xs">Premios ya usados: {usados.length}.</p>}
      {racha.sinMarcar > 0 && (
        <p className="mt-1 text-xs text-red-700">
          ⚠️ Hay {racha.sinMarcar} turno{racha.sinMarcar > 1 ? "s" : ""} de control ya pasado{racha.sinMarcar > 1 ? "s" : ""} sin marcar si vino o no: hasta que se marque, no cuenta para la tarjeta.
        </p>
      )}
      <p className="mt-1 text-[11px] text-amber-800/80">Se cuenta desde las visitas de la agenda: faltar sin avisar la vuelve a cero.</p>
    </div>
  );
}
