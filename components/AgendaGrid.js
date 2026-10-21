"use client";

import {
  CONSULTORIOS,
  bloquesQueOcupa,
  colorDeTurno,
  seMuestraEnGrilla,
} from "@/lib/agenda";

function construirOcupacion(turnosVisibles, bloques, minutosPorBloque, columnas, claveDe = (turno) => turno.consultorio) {
  const ocupacion = {};
  for (const columna of columnas) ocupacion[columna] = {};

  for (const turno of turnosVisibles) {
    const span = bloquesQueOcupa(turno, minutosPorBloque);
    const indiceInicio = bloques.indexOf(turno.horaInicio);
    if (indiceInicio === -1) continue; // el turno arranca fuera del horario mostrado
    const clave = claveDe(turno);
    if (!ocupacion[clave]) continue; // consultorio fuera de los que muestra esta grilla

    ocupacion[clave][bloques[indiceInicio]] = {
      tipo: "inicio",
      turno,
      span,
    };
    for (let i = 1; i < span; i++) {
      const bloque = bloques[indiceInicio + i];
      if (bloque) ocupacion[clave][bloque] = { tipo: "ocupado" };
    }
  }
  return ocupacion;
}

export default function AgendaGrid({
  turnos,
  bloques,
  consultorios = CONSULTORIOS,
  minutosPorBloque = 30,
  onSlotClick,
  onTurnoClick,
  renderSubtitulo,
}) {
  const turnosVisibles = turnos.filter(seMuestraEnGrilla);
  const sobreturnos = turnosVisibles.filter((t) => t.sobreturno);
  const ocupacion = construirOcupacion(
    turnosVisibles.filter((t) => !t.sobreturno),
    bloques,
    minutosPorBloque,
    consultorios
  );
  const haySobreturnos = sobreturnos.length > 0;
  if (haySobreturnos) ocupacion.S = construirOcupacion(sobreturnos, bloques, minutosPorBloque, ["S"], () => "S").S;
  const columnas = haySobreturnos ? [...consultorios, "S"] : consultorios;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-brand-brown text-white">
            <th className="w-20 border border-gray-300 px-2 py-2 text-left font-semibold">Hora</th>
            {columnas.map((c) => (
              <th key={c} className="border border-gray-300 px-2 py-2 text-left font-semibold">
                {c === "S" ? "🔁 Sobreturnos" : `Consultorio ${c}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bloques.map((bloque) => (
            <tr key={bloque} className="h-10">
              <td className="border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 align-top">
                {bloque}
              </td>
              {columnas.map((consultorio) => {
                const celda = ocupacion[consultorio][bloque];

                if (celda?.tipo === "ocupado") {
                  return null; // ya cubierto por el rowSpan de un turno que empezó antes
                }

                if (celda?.tipo === "inicio") {
                  const { turno } = celda;
                  const color = colorDeTurno(turno);
                  const subtitulo = renderSubtitulo
                    ? renderSubtitulo(turno)
                    : turno.prestaciones?.length
                      ? turno.prestaciones.map((p) => p.prestacion).join(", ")
                      : turno.tipoAtencion;
                  return (
                    <td
                      key={consultorio}
                      rowSpan={celda.span}
                      onClick={() => onTurnoClick?.(turno)}
                      className={`cursor-pointer border p-1.5 align-top hover:brightness-95 ${
                        turno.tipoOtroOrtodoncista === "Sobreturno" ? "border-2 border-dashed border-amber-600" : "border-gray-300"
                      } ${color.bg} ${color.text}`}
                    >
                      <div className="font-semibold leading-tight">{turno.paciente}</div>
                      <div className="text-xs opacity-90 leading-tight">
                        {subtitulo} · {turno.profesionalDeTurno}
                      </div>
                      {turno.tipoOtroOrtodoncista === "Sobreturno" ? (
                        <div className="text-[11px] font-bold leading-tight">
                          🔁 SOBRETURNO{turno.ortodoncistaHabitual ? ` — es paciente de ${turno.ortodoncistaHabitual}` : ""}
                        </div>
                      ) : turno.tipoOtroOrtodoncista === "Cobertura" ? (
                        <div className="text-[11px] font-semibold leading-tight">
                          ↔ Cobertura{turno.ortodoncistaHabitual ? ` de ${turno.ortodoncistaHabitual}` : ""}
                        </div>
                      ) : (
                        turno.prioridad && (
                          <div className="text-[11px] font-semibold leading-tight">
                            ⭐ Prioridad{turno.ortodoncistaHabitual ? ` — es paciente de ${turno.ortodoncistaHabitual}` : ""}
                          </div>
                        )
                      )}
                      {!turno.prioridad && turno.profesionalResponsable && turno.profesionalResponsable !== turno.profesionalDeTurno && (
                        <div className="text-[11px] font-medium opacity-90 leading-tight">
                          👤 Responsable: {turno.profesionalResponsable}
                        </div>
                      )}
                      {turno.observaciones?.trim() && (
                        <div
                          className="mt-0.5 line-clamp-3 whitespace-pre-line rounded bg-white/60 px-1 py-0.5 text-[11px] font-medium leading-tight text-gray-900"
                          title={turno.observaciones}
                        >
                          📝 {turno.observaciones.trim()}
                        </div>
                      )}
                      {turno.consentimientoPendiente && (
                        <div
                          className="mt-0.5 rounded bg-amber-100 px-1 py-0.5 text-[11px] font-semibold leading-tight text-amber-900"
                          title="A este paciente le falta firmar el consentimiento"
                        >
                          ✍️ Falta firmar el consentimiento
                        </div>
                      )}
                      <div className="text-[11px] opacity-80 leading-tight">
                        {color.etiqueta}
                        {turno.confirmacion === "Confirmado" && color.etiqueta !== "Confirmado" && " · ✓ Confirmado"}
                      </div>
                    </td>
                  );
                }

                if (consultorio === "S") {
                  return <td key={consultorio} className="border border-gray-200 bg-amber-50/40 p-1.5 align-top" />;
                }

                return (
                  <td
                    key={consultorio}
                    className="cursor-pointer border border-gray-200 bg-white p-1.5 align-top hover:bg-gray-50"
                    onClick={() => onSlotClick?.(consultorio, bloque)}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
