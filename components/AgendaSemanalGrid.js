"use client";

import { NOMBRES_DIA_SEMANA, colorDeTurno, diaSemanaDeFecha, seMuestraEnGrilla, sumarDias } from "@/lib/agenda";

export default function AgendaSemanalGrid({ fechaInicio, turnos, bloques, onTurnoClick }) {
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(fechaInicio, i));
  const turnosVisibles = turnos.filter(seMuestraEnGrilla);

  const porDiaYHora = {};
  for (const dia of dias) porDiaYHora[dia] = {};
  for (const turno of turnosVisibles) {
    if (!porDiaYHora[turno.fecha]) continue;
    if (!porDiaYHora[turno.fecha][turno.horaInicio]) porDiaYHora[turno.fecha][turno.horaInicio] = [];
    porDiaYHora[turno.fecha][turno.horaInicio].push(turno);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-brand-brown text-white">
            <th className="sticky left-0 z-10 w-16 border border-gray-700 bg-brand-brown px-2 py-2 text-left font-semibold">
              Hora
            </th>
            {dias.map((dia) => (
              <th key={dia} className="border border-gray-700 px-2 py-2 text-left font-semibold">
                {NOMBRES_DIA_SEMANA[diaSemanaDeFecha(dia)].slice(0, 3)}{" "}
                <span className="font-normal text-gray-300">{dia.slice(8, 10)}/{dia.slice(5, 7)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bloques.map((bloque) => (
            <tr key={bloque} className="h-8">
              <td className="sticky left-0 z-10 border border-gray-200 bg-white px-2 py-1 font-medium text-gray-500">
                {bloque}
              </td>
              {dias.map((dia) => {
                const turnosDelSlot = porDiaYHora[dia][bloque] || [];
                return (
                  <td key={dia} className="border border-gray-100 p-0.5 align-top">
                    <div className="flex flex-col gap-0.5">
                      {turnosDelSlot.map((turno) => {
                        const color = colorDeTurno(turno);
                        return (
                          <button
                            key={turno.id}
                            onClick={() => onTurnoClick?.(turno)}
                            title={`${turno.paciente} · ${bloque} · Consultorio ${turno.consultorio}`}
                            className={`w-full truncate rounded-sm px-1 py-0.5 text-left leading-tight hover:brightness-95 ${color.bg} ${color.text}`}
                          >
                            {turno.paciente}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
