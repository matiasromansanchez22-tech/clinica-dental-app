import { supabase } from "@/lib/supabaseClient";

// Lo que el profesional marca como "hecho" en la Agenda — para que Caja
// venga pre-completado en vez de que el secretario tenga que preguntar qué
// se hizo. Sirve tanto para pacientes con plan/presupuesto (pasos del plan)
// como sin plan (prestaciones sueltas), y también para Ortodoncia.

// ---------- Sistema General — pasos de un plan/presupuesto ----------

// Los pasos del presupuesto de un plan, con el estado de cada uno: ya
// cobrado, marcado pendiente de cobro, o todavía sin marcar.
export async function obtenerPasosDelPlan(presupuestoId) {
  if (!presupuestoId) return [];
  const [{ data: presupuesto, error: e1 }, { data: realizados, error: e2 }] = await Promise.all([
    supabase.from("presupuestos").select("prestaciones").eq("id", presupuestoId).single(),
    supabase.from("prestaciones_realizadas_agenda").select("id, prestacion, cobrado").eq("presupuesto_id", presupuestoId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const estadoPorNombre = {};
  for (const r of realizados || []) {
    if (!estadoPorNombre[r.prestacion] || r.cobrado) estadoPorNombre[r.prestacion] = r;
  }
  return (presupuesto?.prestaciones || [])
    .map((p) => p.prestacion)
    .filter(Boolean)
    .map((nombre) => ({
      nombre,
      realizadoId: estadoPorNombre[nombre]?.id || null,
      cobrado: Boolean(estadoPorNombre[nombre]?.cobrado),
    }));
}

export async function marcarPasoPlanRealizado({ presupuestoId, prestacion, pacienteId, profesionalId, turnoGeneralId, fecha }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("prestaciones_realizadas_agenda").insert({
    fecha,
    profesional_id: profesionalId || null,
    turno_general_id: turnoGeneralId || null,
    paciente_id: pacienteId,
    presupuesto_id: presupuestoId,
    prestacion,
    usuario_id: user?.id ?? null,
  });
  if (error) throw error;
}

// Solo se puede desmarcar si todavía no se cobró — una vez cobrado, el
// registro queda como historial de ese cobro.
export async function desmarcarPasoRealizado(id) {
  const { error } = await supabase.from("prestaciones_realizadas_agenda").delete().eq("id", id).eq("cobrado", false);
  if (error) throw error;
}

// ---------- Sistema General — prestaciones sueltas (sin plan) ----------

export async function obtenerPrestacionesAdHocPendientes(pacienteId) {
  const { data, error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .select("id, catalogo_id, prestacion, cantidad")
    .eq("paciente_id", pacienteId)
    .is("presupuesto_id", null)
    .eq("cobrado", false)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function marcarPrestacionAdHocRealizada({
  catalogoId,
  prestacion,
  cantidad,
  pacienteId,
  profesionalId,
  turnoGeneralId,
  fecha,
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("prestaciones_realizadas_agenda").insert({
    fecha,
    profesional_id: profesionalId || null,
    turno_general_id: turnoGeneralId || null,
    paciente_id: pacienteId,
    catalogo_id: catalogoId,
    prestacion,
    cantidad: cantidad || 1,
    usuario_id: user?.id ?? null,
  });
  if (error) throw error;
}

export async function quitarPrestacionAdHocPendiente(id) {
  const { error } = await supabase.from("prestaciones_realizadas_agenda").delete().eq("id", id).eq("cobrado", false);
  if (error) throw error;
}

// ---------- Sistema General — lo que usa Caja para pre-completarse ----------

export async function obtenerPendientesDeCobro(pacienteId) {
  const { data, error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .select("id, presupuesto_id, catalogo_id, prestacion, cantidad")
    .eq("paciente_id", pacienteId)
    .eq("cobrado", false);
  if (error) throw error;
  return {
    plan: (data || []).filter((d) => d.presupuesto_id).map((d) => ({ id: d.id, nombre: d.prestacion })),
    adHoc: (data || [])
      .filter((d) => !d.presupuesto_id)
      .map((d) => ({ id: d.id, catalogoId: d.catalogo_id, prestacion: d.prestacion, cantidad: d.cantidad })),
  };
}

export async function marcarPendientesComoCobrados(ids, cajaGeneralId) {
  if (!ids?.length) return;
  const { error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .update({ cobrado: true, caja_general_id: cajaGeneralId })
    .in("id", ids);
  if (error) throw error;
}

// ---------- Ortodoncia ----------

export async function marcarTurnoOrtodonciaRealizado({
  turnoOrtodonciaId,
  pacienteOrtodonciaId,
  ortodoncistaId,
  concepto,
  fecha,
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("prestaciones_realizadas_agenda").insert({
    fecha,
    profesional_id: ortodoncistaId || null,
    turno_ortodoncia_id: turnoOrtodonciaId || null,
    paciente_ortodoncia_id: pacienteOrtodonciaId,
    prestacion: concepto,
    usuario_id: user?.id ?? null,
  });
  if (error) throw error;
}

// El turno más reciente marcado como "hecho" y todavía no cobrado — para
// pre-completar el concepto al abrir un cobro de ese paciente.
export async function obtenerPendienteCobroOrtodoncia(pacienteOrtodonciaId) {
  const { data, error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .select("id, prestacion, created_at")
    .eq("paciente_ortodoncia_id", pacienteOrtodonciaId)
    .eq("cobrado", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function marcarPendienteOrtodonciaComoCobrado(id, cajaOrtodonciaId) {
  const { error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .update({ cobrado: true, caja_ortodoncia_id: cajaOrtodonciaId })
    .eq("id", id);
  if (error) throw error;
}
