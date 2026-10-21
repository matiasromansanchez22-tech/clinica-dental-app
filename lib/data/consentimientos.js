import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";

// Registro de pacientes a los que todavía les falta firmar el consentimiento (Odontología General y Ortodoncia), con cuándo vienen la
// próxima vez y cuándo vinieron por última vez, para hacerlo firmar en la visita. En Ortodoncia el campo es texto ("SI", "NO", "si en
// papel", vacío): cuenta como firmado cualquier valor que empiece con "si".

const VINO = ["En espera", "En consultorio", "Finalizado"];

async function traerTodo(consulta) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta().range(desde, desde + 999);
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas;
}

function haceDias(fechaISO, dias) {
  const d = new Date(`${fechaISO}T12:00:00`);
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function agruparVisitas(turnos, hoy) {
  const proximo = {};
  const ultima = {};
  for (const t of turnos) {
    if (!t.paciente_id) continue;
    if (t.fecha >= hoy && (!proximo[t.paciente_id] || t.fecha < proximo[t.paciente_id])) proximo[t.paciente_id] = t.fecha;
    if (t.fecha <= hoy && VINO.includes(t.presencia) && (!ultima[t.paciente_id] || t.fecha > ultima[t.paciente_id])) ultima[t.paciente_id] = t.fecha;
  }
  return { proximo, ultima };
}

export async function obtenerConsentimientosPendientes() {
  const hoy = fechaDeHoyISO();
  const desde = haceDias(hoy, 180);
  const [general, orto, turnosGeneral, turnosOrto] = await Promise.all([
    traerTodo(() =>
      supabase
        .from("pacientes")
        .select("id, apellido_y_nombre, celular, estado, tipo_paciente, profesional_responsable:profesionales(nombre)")
        .eq("estado", "Activo")
        .eq("consentimientos_firmados", false)
        .order("apellido_y_nombre")
    ),
    traerTodo(() =>
      supabase
        .from("pacientes_ortodoncia")
        .select("id, nombre, whatsapp, estado_paciente, consentimiento, ortodoncista:profesionales!ortodoncista_id(nombre)")
        .in("estado_paciente", ["Activo", "Consulta"])
        .order("nombre")
    ),
    traerTodo(() => supabase.from("turnos_general").select("paciente_id, fecha, presencia, estado").neq("estado", "Cancelado").gte("fecha", desde)),
    traerTodo(() => supabase.from("turnos_ortodoncia").select("paciente_id, fecha, presencia, estado").eq("estado", "Agendado").gte("fecha", desde)),
  ]);
  const vg = agruparVisitas(turnosGeneral, hoy);
  const vo = agruparVisitas(turnosOrto, hoy);

  return {
    hoy,
    general: general.map((p) => ({
      sistema: "general",
      id: p.id,
      nombre: p.apellido_y_nombre?.trim() || "(sin nombre)",
      telefono: p.celular || null,
      detalle: p.tipo_paciente || null,
      profesional: p.profesional_responsable?.nombre ?? null,
      proximoTurno: vg.proximo[p.id] || null,
      ultimaVisita: vg.ultima[p.id] || null,
    })),
    ortodoncia: orto
      .filter((p) => !/^si/i.test((p.consentimiento || "").trim()))
      .map((p) => ({
        sistema: "ortodoncia",
        id: p.id,
        nombre: p.nombre?.trim() || "(sin nombre)",
        telefono: p.whatsapp || null,
        detalle: p.estado_paciente === "Consulta" ? "Consulta" : null,
        profesional: p.ortodoncista?.nombre ?? null,
        proximoTurno: vo.proximo[p.id] || null,
        ultimaVisita: vo.ultima[p.id] || null,
      })),
  };
}

// Se marca firmado: en General el tilde de la ficha (y cuándo se marcó, para las estadísticas); en Ortodoncia el campo queda en "SI".
export async function marcarConsentimientoFirmado(sistema, id) {
  if (sistema === "ortodoncia") {
    const { error } = await supabase.from("pacientes_ortodoncia").update({ consentimiento: "SI", updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    return;
  }
  const { data, error: errorLeer } = await supabase.from("pacientes").select("consentimiento_marcado_en").eq("id", id).single();
  if (errorLeer) throw errorLeer;
  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from("pacientes")
    .update({ consentimientos_firmados: true, ...(data.consentimiento_marcado_en ? {} : { consentimiento_marcado_en: ahora }), updated_at: ahora })
    .eq("id", id);
  if (error) throw error;
}

// Para el aviso dentro del turno: ¿a este paciente le falta firmar?
export async function consentimientoPendienteDe(sistema, id) {
  if (!id) return false;
  if (sistema === "ortodoncia") {
    const { data, error } = await supabase.from("pacientes_ortodoncia").select("consentimiento").eq("id", id).maybeSingle();
    if (error || !data) return false;
    return !/^si/i.test((data.consentimiento || "").trim());
  }
  const { data, error } = await supabase.from("pacientes").select("consentimientos_firmados").eq("id", id).maybeSingle();
  if (error || !data) return false;
  return !data.consentimientos_firmados;
}
