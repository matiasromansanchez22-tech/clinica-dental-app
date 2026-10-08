import { fechaDeHoyISO } from "@/lib/agenda";

// Circuito de un trabajo de laboratorio: cada trabajo está siempre en UNA etapa,
// y puede dar varias vueltas (mecánico → clínica → prueba → mecánico...) antes de
// entregarse. La etapa y la vuelta se calculan leyendo el historial de eventos del
// trabajo, así los trabajos ya cargados encajan solos sin recargar nada.
export const ETAPAS = [
  { id: "pendiente_envio", titulo: "📋 Pendiente de envío", ayuda: "En la clínica, falta mandarlo al mecánico", colorBorde: "border-sky-300", colorFondo: "bg-sky-50" },
  { id: "en_mecanico", titulo: "📦 En el mecánico", ayuda: "Lo tiene el mecánico", colorBorde: "border-violet-300", colorFondo: "bg-violet-50" },
  { id: "en_clinica", titulo: "📥 Llegó a la clínica", ayuda: "Falta probárselo al paciente", colorBorde: "border-amber-300", colorFondo: "bg-amber-50" },
  { id: "probado", titulo: "🦷 Probado, falta definir", ayuda: "Se probó: ¿hay que ajustar o está bien?", colorBorde: "border-orange-300", colorFondo: "bg-orange-50" },
  { id: "listo", titulo: "✅ Listo para entregar", ayuda: "Aprobado en la prueba", colorBorde: "border-emerald-300", colorFondo: "bg-emerald-50" },
  { id: "entregado", titulo: "🎁 Entregados", ayuda: "Entregados al paciente en los últimos 30 días", colorBorde: "border-gray-300", colorFondo: "bg-gray-50" },
];

// Cuántos días se siguen mostrando los trabajos ya entregados en el tablero.
export const DIAS_ENTREGADOS_VISIBLES = 30;

// Días en la etapa a partir de los cuales aparece el amarillo / el rojo.
const UMBRALES = {
  pendiente_envio: { amarillo: 2, rojo: 5 },
  en_mecanico: { amarillo: 5, rojo: 10 },
  en_clinica: { amarillo: 3, rojo: 7 },
  probado: { amarillo: 1, rojo: 3 },
  listo: { amarillo: 5, rojo: 10 },
};

function diasDesde(fechaISO) {
  if (!fechaISO) return 0;
  const hoy = new Date(fechaDeHoyISO() + "T12:00:00");
  const inicio = new Date(fechaISO + "T12:00:00");
  return Math.max(Math.round((hoy - inicio) / (1000 * 60 * 60 * 24)), 0);
}

function etapaPorEstado(estado) {
  switch (estado) {
    case "Pendiente de envío":
      return "pendiente_envio";
    case "Enviado al mecánico":
    case "Ajuste pendiente":
      return "en_mecanico";
    case "Recibido del mecánico":
      return "en_clinica";
    case "Prueba con el paciente":
      return "probado";
    case "Listo para entregar":
      return "listo";
    case "Entregado":
      return "entregado";
    default:
      return "en_mecanico";
  }
}

// eventos: [{ fecha, tipoEvento }] en orden cronológico (los de la misma fecha en
// el orden en que se cargaron).
export function calcularCircuito(trabajo, eventos = []) {
  const pruebas = eventos.filter((e) => e.tipoEvento === "Prueba con el paciente").length;
  const ultimo = eventos[eventos.length - 1] || null;

  let etapa;
  if (!ultimo) {
    etapa = etapaPorEstado(trabajo.estado);
  } else {
    switch (ultimo.tipoEvento) {
      case "Enviado al mecánico":
      case "Ajuste - reenviado":
        etapa = "en_mecanico";
        break;
      case "Recibido del mecánico":
        etapa = "en_clinica";
        break;
      case "Prueba con el paciente":
        etapa = "probado";
        break;
      case "Prueba aprobada":
        etapa = "listo";
        break;
      case "Alta / Entregado":
        etapa = "entregado";
        break;
      default:
        etapa = etapaPorEstado(trabajo.estado);
    }
    // Si el estado del trabajo ya dice "Pendiente de envío" o "Entregado" manda eso
    // (por ejemplo, un trabajo sin eventos o reabierto a mano).
    if (trabajo.estado === "Pendiente de envío") etapa = "pendiente_envio";
  }

  // "Vuelta": qué toca en esta etapa, en palabras simples.
  let vuelta = "";
  if (etapa === "en_mecanico") {
    vuelta = pruebas === 0 ? (eventos.some((e) => e.tipoEvento === "Ajuste - reenviado") ? "Reenviado para ajuste" : "Envío inicial") : `Reenvío tras la prueba ${pruebas}`;
  } else if (etapa === "en_clinica") {
    vuelta = pruebas === 0 ? "Primera prueba" : `Prueba ${pruebas + 1}`;
  } else if (etapa === "probado") {
    vuelta = `Prueba ${pruebas} hecha`;
  } else if (etapa === "listo") {
    vuelta = pruebas > 0 ? `Aprobado en la prueba ${pruebas}` : "Aprobado";
  } else if (etapa === "entregado") {
    vuelta = pruebas > 0 ? `${pruebas} prueba${pruebas === 1 ? "" : "s"}` : "Sin prueba";
  }

  const desde =
    (etapa === "entregado" && trabajo.fechaAlta) || ultimo?.fecha || trabajo.fechaUltimoEvento || trabajo.fechaInicio;
  const dias = diasDesde(desde);
  const umbral = UMBRALES[etapa];
  const semaforo = !umbral ? "verde" : dias >= umbral.rojo ? "rojo" : dias >= umbral.amarillo ? "amarillo" : "verde";

  return { etapa, pruebas, vuelta, desde, dias, semaforo };
}

export const COLOR_SEMAFORO = {
  verde: { emoji: "🟢", clase: "text-emerald-700" },
  amarillo: { emoji: "🟡", clase: "text-amber-700" },
  rojo: { emoji: "🔴", clase: "text-red-700" },
};
