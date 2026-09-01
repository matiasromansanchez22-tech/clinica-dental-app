"use client";

import {
  CONSULTORIOS,
  bloquesQueOcupa,
  colorDeTurno,
  seMuestraEnGrilla,
} from "@/lib/agenda";

function construirOcupacion(turnosVisibles, bloques, minutosPorBloque, consultorios) {
  const ocupacion = {};
  for (const consultorio of consultorios) ocupacion[consultorio] = {};

  for (const turno of turnosVisibles) {
    const span = bloquesQueOcupa(turno, minutosPorBloque);
    const indiceInicio = bloques.indexOf(turno.horaInicio);
    if (indiceInicio === -1) continue; // el turno arranca fuera del horario mostrado
    if (!ocupacion[turno.consultorio]) continue; // consultorio fuera de los que muestra esta grilla

    ocupacion[turno.consultorio][bloques[indiceInicio]] = {
      tipo: "inicio",
      turno,
      span,
    };
    for (let i = 1; i < span; i++) {
      const bloque = bloques[indiceInicio + i];
      if (bloque) ocupacion[turno.consultorio][bloque] = { tipo: "ocupado" };
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
  const ocupacion = construirOcupacion(turnosVisibles, bloques, minutosPorBloque, consultorios);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-brand-brown text-white">
            <th className="w-20 border border-gray-300 px-2 py-2 text-left font-semibold">Hora</th>
            {consultorios.map((c) => (
              <th key={c} className="border border-gray-300 px-2 py-2 text-left font-semibold">
                Consultorio {c}
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
              {consultorios.map((consultorio) => {
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
                      className={`cursor-pointer border border-gray-300 p-1.5 align-top hover:brightness-95 ${color.bg} ${color.text}`}
                    >
                      <div className="font-semibold leading-tight">{turno.paciente}</div>
                      <div className="text-xs opacity-90 leading-tight">
                        {subtitulo} · {turno.profesionalDeTurno}
                      </div>
                      {turno.profesionalResponsable && turno.profesionalResponsable !== turno.profesionalDeTurno && (
                        <div className="text-[11px] font-medium opacity-90 leading-tight">
                          👤 Responsable: {turno.profesionalResponsable}
                        </div>
                      )}
                      <div className="text-[11px] opacity-80 leading-tight">{color.etiqueta}</div>
                    </td>
                  );
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
