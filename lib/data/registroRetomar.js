import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";

// Registro de los pacientes a los que se les escribió desde "Retomar tratamiento": de cada uno, si después del mensaje
// se le dio un turno o ya vino. Es el seguimiento de cuántos de los contactados terminaron volviendo.

export const RESULTADOS_RETOMAR = {
  VINO: "Ya vino",
  TURNO_DADO: "Turno dado después del mensaje",
  YA_TENIA: "Ya tenía turno antes del mensaje",
  SIN_TURNO: "Sin turno todavía",
  CERRADO: "No sigue (no quiere / ya no es paciente)",
};

// Estados en los que realmente se le escribió o se habló con el paciente.
const ESTADOS_CONTACTADOS = ["Mensaje enviado", "Sin respuesta", "Quiere retomar", "Turno agendado"];

// Fecha (AAAA-MM-DD) en Argentina de un instante guardado en UTC.
function fechaLocal(isoUTC) {
  return new Date(isoUTC).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

async function enLotes(ids, consultaPorLote) {
  const filas = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await consultaPorLote(ids.slice(i, i + 100));
    filas.push(...(data || []));
  }
  return filas;
}

export async function obtenerRegistroRetomar() {
  const hoy = fechaDeHoyISO();
  const { data: seguimientos, error } = await supabase
    .from("retomar_ortodoncia")
    .select("paciente_id, estado, nota, fecha_ultimo_contacto, updated_at");
  if (error) return { disponible: false, filas: [], resumen: null };

  const ids = seguimientos.map((s) => s.paciente_id);
  const [pacientes, turnos, cobros] = await Promise.all([
    enLotes(ids, (lote) =>
      supabase.from("pacientes_ortodoncia").select("id, nombre, estado_paciente, ortodoncista:profesionales!ortodoncista_id(nombre)").in("id", lote)
    ),
    enLotes(ids, (lote) =>
      supabase.from("turnos_ortodoncia").select("paciente_id, fecha, hora_inicio, estado, presencia, concepto, created_at").in("paciente_id", lote).eq("estado", "Agendado")
    ),
    enLotes(ids, (lote) => supabase.from("caja_ortodoncia").select("paciente_id, fecha, concepto").in("paciente_id", lote)),
  ]);
  const pacientePorId = Object.fromEntries(pacientes.map((p) => [p.id, p]));

  const filas = seguimientos.map((s) => {
    const contactadoEl = s.fecha_ultimo_contacto || fechaLocal(s.updated_at);
    const suyos = turnos.filter((t) => t.paciente_id === s.paciente_id);
    const futuros = suyos.filter((t) => t.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const turnoNuevo = futuros.find((t) => fechaLocal(t.created_at) >= contactadoEl) || null;
    const turnoAnterior = futuros.find((t) => fechaLocal(t.created_at) < contactadoEl) || null;
    const vino =
      suyos.some((t) => t.fecha >= contactadoEl && t.fecha <= hoy && ["En espera", "En consultorio", "Finalizado"].includes(t.presencia)) ||
      cobros.some((c) => c.paciente_id === s.paciente_id && c.fecha >= contactadoEl && c.fecha <= hoy && c.concepto !== "Pago adelantado");

    let resultado;
    if (!ESTADOS_CONTACTADOS.includes(s.estado)) resultado = RESULTADOS_RETOMAR.CERRADO;
    else if (vino) resultado = RESULTADOS_RETOMAR.VINO;
    else if (turnoNuevo) resultado = RESULTADOS_RETOMAR.TURNO_DADO;
    else if (turnoAnterior) resultado = RESULTADOS_RETOMAR.YA_TENIA;
    else resultado = RESULTADOS_RETOMAR.SIN_TURNO;

    const p = pacientePorId[s.paciente_id];
    return {
      id: s.paciente_id,
      nombre: p?.nombre ?? "(paciente)",
      ortodoncista: p?.ortodoncista?.nombre ?? "Sin asignar",
      estado: s.estado,
      nota: s.nota,
      contactadoEl,
      resultado,
      turnoFecha: (turnoNuevo || turnoAnterior)?.fecha || null,
      turnoHora: (turnoNuevo || turnoAnterior)?.hora_inicio?.slice(0, 5) || null,
      turnoCargadoEl: turnoNuevo ? fechaLocal(turnoNuevo.created_at) : turnoAnterior ? fechaLocal(turnoAnterior.created_at) : null,
    };
  });

  const contactados = filas.filter((f) => f.resultado !== RESULTADOS_RETOMAR.CERRADO);
  const cuenta = (r) => filas.filter((f) => f.resultado === r).length;
  const volvieron = cuenta(RESULTADOS_RETOMAR.VINO) + cuenta(RESULTADOS_RETOMAR.TURNO_DADO);
  const resumen = {
    contactados: contactados.length,
    vino: cuenta(RESULTADOS_RETOMAR.VINO),
    turnoDado: cuenta(RESULTADOS_RETOMAR.TURNO_DADO),
    yaTenia: cuenta(RESULTADOS_RETOMAR.YA_TENIA),
    sinTurno: cuenta(RESULTADOS_RETOMAR.SIN_TURNO),
    cerrados: cuenta(RESULTADOS_RETOMAR.CERRADO),
    volvieron,
    porcentaje: contactados.length > 0 ? Math.round((volvieron / contactados.length) * 100) : null,
  };
  const orden = Object.values(RESULTADOS_RETOMAR);
  filas.sort(
    (a, b) =>
      orden.indexOf(a.resultado) - orden.indexOf(b.resultado) || (b.contactadoEl || "").localeCompare(a.contactadoEl || "") || a.nombre.localeCompare(b.nombre, "es")
  );
  return { disponible: true, filas, resumen };
}
