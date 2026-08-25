// Lógica de la Agenda de Odontología General.
// Basado en la sección 3.1 de Especificacion_Tecnica_Sistema_Clinica_Dental.docx

export const CONSULTORIOS = [1, 2, 3];

export function generarBloquesHorarios(horaInicio = "08:00", horaFin = "20:00", minutosPorBloque = 30) {
  const bloques = [];
  const [hIni, mIni] = horaInicio.split(":").map(Number);
  const [hFin, mFin] = horaFin.split(":").map(Number);
  let minutosActuales = hIni * 60 + mIni;
  const minutosFinales = hFin * 60 + mFin;
  while (minutosActuales < minutosFinales) {
    const h = Math.floor(minutosActuales / 60);
    const m = minutosActuales % 60;
    bloques.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    minutosActuales += minutosPorBloque;
  }
  return bloques;
}

export function minutosDesdeHora(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function bloquesQueOcupa(turno, minutosPorBloque = 30) {
  return Math.max(1, Math.round(turno.duracionMin / minutosPorBloque));
}

// Regla crítica (doc 3.1): un turno Cancelado/Reprogramado desaparece de la
// grilla y libera el horario, salvo que se le haya marcado Presencia física
// (esa presencia siempre gana, sin importar qué se cargó antes).
export function seMuestraEnGrilla(turno) {
  const motivoDeOculto =
    turno.estado === "Cancelado" ||
    turno.estado === "Reprogramado" ||
    turno.confirmacion === "Reprogramar";
  const tienePresencia = turno.presencia && turno.presencia !== "Pendiente";
  return !motivoDeOculto || tienePresencia;
}

// Regla crítica (doc 3.1): colores de la grilla por prioridad, el primero
// que aplica gana. Los colores concretos son un punto de partida: se pueden
// ajustar más adelante sin tocar la lógica de prioridad.
export function colorDeTurno(turno) {
  if (turno.asistencia === "Asistió") {
    return { bg: "bg-emerald-600", text: "text-white", etiqueta: "Asistió" };
  }
  if (turno.asistencia === "No asistió") {
    return { bg: "bg-red-600", text: "text-white", etiqueta: "No asistió" };
  }
  if (turno.estado === "Cancelado") {
    return { bg: "bg-gray-400", text: "text-white line-through", etiqueta: "Cancelado" };
  }
  if (turno.presencia === "En espera") {
    return { bg: "bg-amber-400", text: "text-gray-900", etiqueta: "En espera" };
  }
  if (turno.presencia === "En consultorio") {
    return { bg: "bg-sky-500", text: "text-white", etiqueta: "En consultorio" };
  }
  if (turno.presencia === "Finalizado") {
    return { bg: "bg-violet-500", text: "text-white", etiqueta: "Finalizado" };
  }
  if (turno.estado === "Reprogramado" || turno.confirmacion === "Reprogramar") {
    return { bg: "bg-orange-400", text: "text-white", etiqueta: "Reprogramar" };
  }
  if (turno.confirmacion === "No responde") {
    return { bg: "bg-pink-400", text: "text-white", etiqueta: "No responde" };
  }
  if (turno.confirmacion === "Confirmado") {
    return { bg: "bg-green-300", text: "text-gray-900", etiqueta: "Confirmado" };
  }
  // Agendado: gris neutro a propósito, para no confundir con Confirmado.
  return { bg: "bg-gray-200", text: "text-gray-900", etiqueta: "Agendado" };
}
