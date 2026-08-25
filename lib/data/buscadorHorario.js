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
import { obtenerTurnosGeneralPorRango } from "@/lib/data/turnosGeneral";

// Doc 3.1: dado un profesional, una duración y una preferencia opcional de
// mañana/tarde, recorre los próximos 30 días calendario y devuelve las
// combinaciones de día+hora realmente libres, respetando su disponibilidad
// semanal cargada.
export async function buscarProximosHorariosLibres({
  profesionalId,
  duracionMin,
  preferencia, // "manana" | "tarde" | null
  cantidadDias = 30,
  maxResultados = 20,
}) {
  const disponibilidad = await obtenerDisponibilidadProfesional(profesionalId);
  if (disponibilidad.length === 0) return [];

  const fechaInicio = fechaDeHoyISO();
  const fechaFin = sumarDias(fechaInicio, cantidadDias - 1);
  const turnosDelRango = await obtenerTurnosGeneralPorRango(fechaInicio, fechaFin);

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

      for (const hora of generarBloquesHorarios(horaInicioBloque, horaFinBloque, 30)) {
        if (minutosDesdeHora(hora) + duracionMin > finBloqueMin) continue;
        if (preferencia === "manana" && minutosDesdeHora(hora) >= 12 * 60) continue;
        if (preferencia === "tarde" && minutosDesdeHora(hora) < 12 * 60) continue;

        const conflicto = hayConflictoDeHorario({
          turnosVisibles,
          consultorio: bloque.consultorio,
          profesionalDeTurnoId: profesionalId,
          horaInicio: hora,
          duracionMin,
        });

        if (!conflicto) {
          resultados.push({ fecha, hora, consultorio: bloque.consultorio });
          if (resultados.length >= maxResultados) break;
        }
      }
      if (resultados.length >= maxResultados) break;
    }
  }

  return resultados;
}
