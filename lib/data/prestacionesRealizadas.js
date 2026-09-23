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
    .select("id, catalogo_id, prestacion, cantidad, precio_manual")
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
  precioManual,
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
    precio_manual: precioManual || null,
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
    .select("id, presupuesto_id, catalogo_id, prestacion, cantidad, precio_manual")
    .eq("paciente_id", pacienteId)
    .eq("cobrado", false);
  if (error) throw error;
  return {
    plan: (data || []).filter((d) => d.presupuesto_id).map((d) => ({ id: d.id, nombre: d.prestacion })),
    adHoc: (data || [])
      .filter((d) => !d.presupuesto_id)
      .map((d) => ({
        id: d.id,
        catalogoId: d.catalogo_id,
        prestacion: d.prestacion,
        cantidad: d.cantidad,
        precioManual: d.precio_manual,
      })),
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
  bracketReposicion,
  cantidadBrackets,
  notaProximoTurno,
  cargoExtraDescripcion,
  cargoExtraMonto,
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
    bracket_reposicion: bracketReposicion || null,
    cantidad_brackets: bracketReposicion ? cantidadBrackets || 1 : null,
    nota_proximo_turno: notaProximoTurno || null,
    cargo_extra_descripcion: cargoExtraMonto ? cargoExtraDescripcion || null : null,
    cargo_extra_monto: cargoExtraMonto || null,
    usuario_id: user?.id ?? null,
  });
  if (error) throw error;
}

// El turno más reciente marcado como "hecho" y todavía no cobrado — para
// pre-completar el concepto al abrir un cobro de ese paciente.
export async function obtenerPendienteCobroOrtodoncia(pacienteOrtodonciaId) {
  const { data, error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .select(
      "id, prestacion, bracket_reposicion, cantidad_brackets, nota_proximo_turno, cargo_extra_descripcion, cargo_extra_monto, created_at"
    )
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

// ---------- Aviso en Caja: quién tiene algo marcado en Agenda, listo para cobrar ----------

export async function obtenerPacientesConPendientesDeCobro() {
  const { data, error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .select("paciente_id")
    .eq("cobrado", false)
    .not("paciente_id", "is", null);
  if (error) throw error;
  const cantidadPorPaciente = {};
  for (const r of data) cantidadPorPaciente[r.paciente_id] = (cantidadPorPaciente[r.paciente_id] || 0) + 1;
  return Object.entries(cantidadPorPaciente).map(([pacienteId, cantidad]) => ({ pacienteId, cantidad }));
}

export async function obtenerCantidadPacientesConPendientesDeCobro() {
  const pacientes = await obtenerPacientesConPendientesDeCobro();
  return pacientes.length;
}

export async function obtenerPacientesOrtodonciaConPendientesDeCobro() {
  const { data, error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .select("paciente_ortodoncia_id")
    .eq("cobrado", false)
    .not("paciente_ortodoncia_id", "is", null);
  if (error) throw error;
  const cantidadPorPaciente = {};
  for (const r of data) cantidadPorPaciente[r.paciente_ortodoncia_id] = (cantidadPorPaciente[r.paciente_ortodoncia_id] || 0) + 1;
  return Object.entries(cantidadPorPaciente).map(([pacienteId, cantidad]) => ({ pacienteId, cantidad }));
}

export async function obtenerCantidadPacientesOrtodonciaConPendientesDeCobro() {
  const pacientes = await obtenerPacientesOrtodonciaConPendientesDeCobro();
  return pacientes.length;
}

// Todo lo pendiente de cobro ahora mismo, agrupado por paciente, con
// nombre, profesional y qué se marcó — para el aviso flotante. Se llama al
// entrar a cualquier pantalla (no solo cuando llega el evento en vivo) para
// que el aviso esté aunque se haya marcado antes de abrir la app o en otro
// dispositivo.
export async function obtenerAvisosPendientesDeCobro() {
  const { data, error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .select(
      "paciente_id, paciente_ortodoncia_id, profesional_id, prestacion, bracket_reposicion, cantidad_brackets, precio_manual, nota_proximo_turno, cargo_extra_descripcion, cargo_extra_monto, created_at"
    )
    .eq("cobrado", false)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const porClave = {};
  for (const r of data) {
    const esOrtodoncia = Boolean(r.paciente_ortodoncia_id);
    const pacienteId = esOrtodoncia ? r.paciente_ortodoncia_id : r.paciente_id;
    if (!pacienteId) continue;
    const clave = `${esOrtodoncia ? "orto" : "general"}-${pacienteId}`;
    if (!porClave[clave]) {
      porClave[clave] = { clave, pacienteId, esOrtodoncia, profesionalId: r.profesional_id, prestaciones: [] };
    }
    let etiqueta = r.bracket_reposicion
      ? `${r.prestacion} + bracket ${r.bracket_reposicion} x${r.cantidad_brackets || 1}`
      : r.prestacion;
    if (r.precio_manual) etiqueta += ` ($${Number(r.precio_manual).toLocaleString("es-AR")})`;
    if (r.cargo_extra_monto) {
      etiqueta += ` + ${r.cargo_extra_descripcion || "cargo extra"} ($${Number(r.cargo_extra_monto).toLocaleString("es-AR")})`;
    }
    if (r.nota_proximo_turno) etiqueta += ` — próximo turno: ${r.nota_proximo_turno}`;
    porClave[clave].prestaciones.push(etiqueta);
  }

  const grupos = Object.values(porClave);
  const idsGeneral = grupos.filter((g) => !g.esOrtodoncia).map((g) => g.pacienteId);
  const idsOrto = grupos.filter((g) => g.esOrtodoncia).map((g) => g.pacienteId);

  const [{ data: pacientesGeneral }, { data: pacientesOrto }] = await Promise.all([
    idsGeneral.length > 0
      ? supabase.from("pacientes").select("id, apellido_y_nombre").in("id", idsGeneral)
      : Promise.resolve({ data: [] }),
    idsOrto.length > 0
      ? supabase.from("pacientes_ortodoncia").select("id, nombre").in("id", idsOrto)
      : Promise.resolve({ data: [] }),
  ]);
  const nombrePorClave = {};
  for (const p of pacientesGeneral || []) nombrePorClave[`general-${p.id}`] = p.apellido_y_nombre;
  for (const p of pacientesOrto || []) nombrePorClave[`orto-${p.id}`] = p.nombre;

  return grupos.map((g) => ({ ...g, nombre: nombrePorClave[g.clave] || "(paciente)" }));
}

// Aviso en vivo (para que le aparezca al secretario esté donde esté en la
// app) cada vez que se marca algo como hecho en Agenda — mismo patrón que
// suscribirseANuevosPresupuestos. Se suscribe a todo (no solo lo de
// paciente particular o de ortodoncia) porque el filtro de Realtime no
// distingue "esta columna no es null" — quien la usa mira qué id vino
// cargado para saber de qué sistema es.
export function suscribirseAPrestacionesRealizadas(alCrearse) {
  const canal = supabase
    .channel("prestaciones_realizadas_en_vivo")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "prestaciones_realizadas_agenda" }, alCrearse)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}

// Avisa en vivo cuando algo pasa a "cobrado" — así el aviso flotante
// desaparece solo en TODOS los dispositivos apenas se registra el cobro,
// no solo en el que lo cobró.
export function suscribirseACobrosDePrestacionesRealizadas(alCobrarse) {
  const canal = supabase
    .channel("prestaciones_cobradas_en_vivo")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "prestaciones_realizadas_agenda", filter: "cobrado=eq.true" },
      alCobrarse
    )
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
