import {
  diaSemanaDeFecha,
  fechaDeHoyISO,
  generarBloquesHorarios,
  hayConflictoDeHorario,
  minutosDesdeHora,
  seMuestraEnGrilla,
  sumarDias,
} from "@/lib/agenda";
import { obtenerDisponibilidadProfesional } from "@/lib/data/profesionales";
import { obtenerTurnosOrtodonciaPorRango } from "@/lib/data/turnosOrtodoncia";

export async function buscarProximosHorariosLibresOrtodoncia({
  profesionalId,
  duracionMin,
  preferencia,
  cantidadDias = 30,
  maxResultados = 20,
}) {
  const disponibilidad = await obtenerDisponibilidadProfesional(profesionalId);
  if (disponibilidad.length === 0) return [];

  const fechaInicio = fechaDeHoyISO();
  const fechaFin = sumarDias(fechaInicio, cantidadDias - 1);
  const turnosDelRango = await obtenerTurnosOrtodonciaPorRango(fechaInicio, fechaFin);

  const turnosPorFecha = new Map();
  turnosDelRango.forEach((t) => {
    if (!turnosPorFecha.has(t.fecha)) turnosPorFecha.set(t.fecha, []);
    turnosPorFecha.get(t.fecha).push(t);
  });

  const resultados = [];

  for (let i = 0; i < cantidadDias && resultados.length < maxResultados; i++) {
    const fecha = sumarDias(fechaInicio, i);
    const diaSemana = diaSemanaDeFecha(fecha);
    const bloquesDelDia = disponibilidad.filter((d) => d.dia_semana === diaSemana);
    if (bloquesDelDia.length === 0) continue;

    const turnosVisibles = (turnosPorFecha.get(fecha) || []).filter(seMuestraEnGrilla);

    for (const bloque of bloquesDelDia) {
      const horaInicioBloque = bloque.hora_inicio.slice(0, 5);
      const horaFinBloque = bloque.hora_fin.slice(0, 5);
      const finBloqueMin = minutosDesdeHora(horaFinBloque);
      const consultorio = bloque.consultorio || 2;

      for (const hora of generarBloquesHorarios(horaInicioBloque, horaFinBloque, 15)) {
        if (minutosDesdeHora(hora) + duracionMin > finBloqueMin) continue;
        if (preferencia === "manana" && minutosDesdeHora(hora) >= 12 * 60) continue;
        if (preferencia === "tarde" && minutosDesdeHora(hora) < 12 * 60) continue;

        const conflicto = hayConflictoDeHorario({
          turnosVisibles,
          consultorio,
          profesionalDeTurnoId: profesionalId,
          horaInicio: hora,
          duracionMin,
        });

        if (!conflicto) {
          resultados.push({ fecha, hora, consultorio });
          if (resultados.length >= maxResultados) break;
        }
      }
      if (resultados.length >= maxResultados) break;
    }
  }

  return resultados;
}
