import { supabase } from "@/lib/supabaseClient";
import { calcularSugerenciaPago } from "@/lib/data/caja";

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
    supabase
      .from("prestaciones_realizadas_agenda")
      .select(
        "id, prestacion, cobrado, nota_proximo_turno, cargo_extra_descripcion, cargo_extra_monto, proxima_prestacion_nombre"
      )
      .eq("presupuesto_id", presupuestoId),
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
      notaProximoTurno: estadoPorNombre[nombre]?.nota_proximo_turno || null,
      cargoExtraDescripcion: estadoPorNombre[nombre]?.cargo_extra_descripcion || null,
      cargoExtraMonto: estadoPorNombre[nombre]?.cargo_extra_monto || null,
      proximaPrestacionNombre: estadoPorNombre[nombre]?.proxima_prestacion_nombre || null,
    }));
}

export async function marcarPasoPlanRealizado({
  presupuestoId,
  prestacion,
  pacienteId,
  profesionalId,
  turnoGeneralId,
  notaProximoTurno,
  cargoExtraDescripcion,
  cargoExtraMonto,
  proximaPrestacionCatalogoId,
  proximaPrestacionNombre,
  proximaPrestacionTiempoMin,
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
    presupuesto_id: presupuestoId,
    prestacion,
    nota_proximo_turno: notaProximoTurno || null,
    cargo_extra_descripcion: cargoExtraMonto ? cargoExtraDescripcion || null : null,
    cargo_extra_monto: cargoExtraMonto || null,
    proxima_prestacion_catalogo_id: proximaPrestacionNombre ? proximaPrestacionCatalogoId || null : null,
    proxima_prestacion_nombre: proximaPrestacionNombre || null,
    proxima_prestacion_tiempo_min: proximaPrestacionNombre ? proximaPrestacionTiempoMin || null : null,
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
    .select("id, catalogo_id, prestacion, cantidad, precio_manual, nota_proximo_turno, proxima_prestacion_nombre")
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
  notaProximoTurno,
  proximaPrestacionCatalogoId,
  proximaPrestacionNombre,
  proximaPrestacionTiempoMin,
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
    nota_proximo_turno: notaProximoTurno || null,
    proxima_prestacion_catalogo_id: proximaPrestacionNombre ? proximaPrestacionCatalogoId || null : null,
    proxima_prestacion_nombre: proximaPrestacionNombre || null,
    proxima_prestacion_tiempo_min: proximaPrestacionNombre ? proximaPrestacionTiempoMin || null : null,
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
    .select(
      "id, presupuesto_id, catalogo_id, prestacion, cantidad, precio_manual, nota_proximo_turno, cargo_extra_descripcion, cargo_extra_monto"
    )
    .eq("paciente_id", pacienteId)
    .eq("cobrado", false);
  if (error) throw error;
  return {
    plan: (data || [])
      .filter((d) => d.presupuesto_id)
      .map((d) => ({
        id: d.id,
        nombre: d.prestacion,
        notaProximoTurno: d.nota_proximo_turno,
        cargoExtraDescripcion: d.cargo_extra_descripcion,
        cargoExtraMonto: d.cargo_extra_monto,
      })),
    adHoc: (data || [])
      .filter((d) => !d.presupuesto_id)
      .map((d) => ({
        id: d.id,
        catalogoId: d.catalogo_id,
        prestacion: d.prestacion,
        cantidad: d.cantidad,
        precioManual: d.precio_manual,
        notaProximoTurno: d.nota_proximo_turno,
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
  proximaPrestacionNombre,
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
    proxima_prestacion_nombre: proximaPrestacionNombre || null,
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
      "id, prestacion, bracket_reposicion, cantidad_brackets, nota_proximo_turno, cargo_extra_descripcion, cargo_extra_monto, proxima_prestacion_nombre, created_at"
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

// Todo lo que el ortodoncista marcó como "hecho" y todavía no se cobró —
// a diferencia de obtenerPendienteCobroOrtodoncia() (que trae solo el más
// reciente, para pre-completar el formulario), esto trae la lista
// completa. Hace falta para cerrar TODO lo pendiente al cobrar, no solo
// lo último — si no, un paciente con dos visitas sin cobrar quedaba con
// una igual marcada "pendiente" para siempre después de pagarle, y la
// nube de "listo para cobrar" nunca se le sacaba de encima.
export async function obtenerPendientesCobroOrtodoncia(pacienteOrtodonciaId) {
  const { data, error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .select(
      "id, prestacion, bracket_reposicion, cantidad_brackets, nota_proximo_turno, cargo_extra_descripcion, cargo_extra_monto, proxima_prestacion_nombre, created_at"
    )
    .eq("paciente_ortodoncia_id", pacienteOrtodonciaId)
    .eq("cobrado", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function marcarPendientesOrtodonciaComoCobrados(ids, cajaOrtodonciaId) {
  if (!ids?.length) return;
  const { error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .update({ cobrado: true, caja_ortodoncia_id: cajaOrtodonciaId })
    .in("id", ids);
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
// Junta nombres de pacientes (General + Ortodoncia) para una lista de
// grupos ya armados — lo comparten el aviso flotante y la lista de
// promesas de pago, así no se duplica la lógica de los dos joins.
async function conNombresDePaciente(grupos) {
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

function etiquetaDePrestacion(r) {
  let etiqueta = r.bracket_reposicion
    ? `${r.prestacion} + bracket ${r.bracket_reposicion} x${r.cantidad_brackets || 1}`
    : r.prestacion;
  if (r.precio_manual) etiqueta += ` ($${Number(r.precio_manual).toLocaleString("es-AR")})`;
  if (r.cargo_extra_monto) {
    etiqueta += ` + ${r.cargo_extra_descripcion || "cargo extra"} ($${Number(r.cargo_extra_monto).toLocaleString("es-AR")})`;
  }
  return etiqueta;
}

// No trae lo que ya tiene fecha de promesa de pago — eso se mudó a
// obtenerPromesasDePago() / "Cuentas por cobrar", para que no siga
// molestando en la nube hasta el día en que el paciente dijo que paga.
// Cuánto habría que cobrar por lo que se marcó en Agenda, para mostrarlo en
// el aviso (Caja lo vuelve a calcular al abrir el cobro). Misma lógica que
// el formulario de cobro: plan → cuota sugerida + cargo extra; obra social
// → copago del nomenclador; particular → precio de efectivo del catálogo
// (o el precio manual que puso el profesional). Si algún ítem no tiene
// precio resoluble, el monto queda como parcial (`incompleto`).
async function calcularMontosGeneral(filas) {
  const montos = {};
  const idsPaciente = [...new Set(filas.map((f) => f.paciente_id).filter(Boolean))];
  if (idsPaciente.length === 0) return montos;

  const idsCatalogo = [...new Set(filas.map((f) => f.catalogo_id).filter(Boolean))];
  const [{ data: pacientes }, { data: planes }, { data: catalogo }, { data: nomenclador }] = await Promise.all([
    supabase.from("pacientes").select("id, tipo_paciente, obra_social").in("id", idsPaciente),
    supabase
      .from("planes_financiacion")
      .select("paciente_id, fecha, valor_cuota, saldo_pendiente, anticipo_acordado, anticipo_cobrado, proxima_cuota")
      .in("paciente_id", idsPaciente)
      .eq("estado_plan", "Activo")
      .gt("saldo_pendiente", 0)
      .order("fecha", { ascending: false }),
    idsCatalogo.length > 0
      ? supabase.from("catalogo_prestaciones").select("id, valor_lista, valor_efectivo").in("id", idsCatalogo)
      : Promise.resolve({ data: [] }),
    idsCatalogo.length > 0
      ? supabase.from("nomenclador").select("id_catalogo, obra_social, copago_oficial").in("id_catalogo", idsCatalogo)
      : Promise.resolve({ data: [] }),
  ]);

  const pacientePorId = Object.fromEntries((pacientes || []).map((p) => [p.id, p]));
  const planPorPaciente = {};
  for (const p of planes || []) if (!planPorPaciente[p.paciente_id]) planPorPaciente[p.paciente_id] = p;
  const catalogoPorId = Object.fromEntries((catalogo || []).map((c) => [c.id, c]));

  for (const pacienteId of idsPaciente) {
    const suyas = filas.filter((f) => f.paciente_id === pacienteId);
    const paciente = pacientePorId[pacienteId];
    const plan = planPorPaciente[pacienteId];
    let monto = 0;
    let incompleto = false;

    if (plan && suyas.some((f) => f.presupuesto_id)) {
      monto = calcularSugerenciaPago(plan).pagoSugerido;
      const conExtra = suyas.find((f) => f.cargo_extra_monto);
      if (conExtra) monto += Number(conExtra.cargo_extra_monto);
    } else {
      const esObraSocial = paciente?.tipo_paciente === "Obra Social" || paciente?.tipo_paciente === "Mixto";
      const obra = esObraSocial ? (paciente.obra_social || "").trim().toLowerCase() : "";
      for (const f of suyas.filter((x) => !x.presupuesto_id)) {
        const cantidad = Number(f.cantidad) || 1;
        if (f.precio_manual) {
          monto += Number(f.precio_manual) * cantidad;
          continue;
        }
        if (obra) {
          const fila = (nomenclador || []).find(
            (n) => n.id_catalogo === f.catalogo_id && (n.obra_social || "").trim().toLowerCase() === obra
          );
          if (fila) monto += (Number(fila.copago_oficial) || 0) * cantidad;
          else incompleto = true;
          continue;
        }
        const item = catalogoPorId[f.catalogo_id];
        const valor = item ? item.valor_efectivo ?? item.valor_lista : null;
        if (valor == null) incompleto = true;
        else monto += Number(valor) * cantidad;
      }
    }
    montos[pacienteId] = { monto, incompleto };
  }
  return montos;
}

export async function obtenerAvisosPendientesDeCobro() {
  const { data, error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .select(
      "paciente_id, paciente_ortodoncia_id, profesional_id, presupuesto_id, catalogo_id, cantidad, prestacion, bracket_reposicion, cantidad_brackets, precio_manual, nota_proximo_turno, cargo_extra_descripcion, cargo_extra_monto, created_at"
    )
    .eq("cobrado", false)
    .is("fecha_promesa_pago", null)
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
    let etiqueta = etiquetaDePrestacion(r);
    if (r.nota_proximo_turno) etiqueta += ` — próximo turno: ${r.nota_proximo_turno}`;
    porClave[clave].prestaciones.push(etiqueta);
  }

  const montos = await calcularMontosGeneral(data.filter((r) => !r.paciente_ortodoncia_id)).catch(() => ({}));
  const grupos = Object.values(porClave).map((g) => ({
    ...g,
    monto: g.esOrtodoncia ? null : (montos[g.pacienteId]?.monto ?? null),
    montoIncompleto: g.esOrtodoncia ? false : Boolean(montos[g.pacienteId]?.incompleto),
  }));
  return conNombresDePaciente(grupos);
}

// El paciente no va a pagar hoy lo que se marcó — se le pone una fecha
// prometida a TODO lo que tenga pendiente (no solo a un ítem), porque la
// nube junta todo lo de un mismo paciente en una sola tarjeta.
export async function marcarPromesaDePago({ pacienteId, esOrtodoncia, fechaPromesa }) {
  const columna = esOrtodoncia ? "paciente_ortodoncia_id" : "paciente_id";
  const { error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .update({ fecha_promesa_pago: fechaPromesa })
    .eq(columna, pacienteId)
    .eq("cobrado", false);
  if (error) throw error;
}

// Por si se equivocaron de fecha o el paciente al final paga hoy — la
// vuelve a mandar a la nube.
export async function quitarPromesaDePago({ pacienteId, esOrtodoncia }) {
  const columna = esOrtodoncia ? "paciente_ortodoncia_id" : "paciente_id";
  const { error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .update({ fecha_promesa_pago: null })
    .eq(columna, pacienteId)
    .eq("cobrado", false);
  if (error) throw error;
}

// Para la sección nueva en "Cuentas por cobrar" — todo lo que tiene fecha
// prometida y todavía no se cobró, ordenado por esa fecha.
export async function obtenerPromesasDePago() {
  const { data, error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .select(
      "paciente_id, paciente_ortodoncia_id, profesional_id, prestacion, bracket_reposicion, cantidad_brackets, precio_manual, cargo_extra_descripcion, cargo_extra_monto, fecha_promesa_pago, created_at"
    )
    .eq("cobrado", false)
    .not("fecha_promesa_pago", "is", null)
    .order("fecha_promesa_pago", { ascending: true });
  if (error) throw error;

  const porClave = {};
  for (const r of data) {
    const esOrtodoncia = Boolean(r.paciente_ortodoncia_id);
    const pacienteId = esOrtodoncia ? r.paciente_ortodoncia_id : r.paciente_id;
    if (!pacienteId) continue;
    const clave = `${esOrtodoncia ? "orto" : "general"}-${pacienteId}`;
    if (!porClave[clave]) {
      porClave[clave] = {
        clave,
        pacienteId,
        esOrtodoncia,
        profesionalId: r.profesional_id,
        fechaPromesa: r.fecha_promesa_pago,
        prestaciones: [],
      };
    }
    porClave[clave].prestaciones.push(etiquetaDePrestacion(r));
  }

  const grupos = await conNombresDePaciente(Object.values(porClave));
  return grupos.sort((a, b) => a.fechaPromesa.localeCompare(b.fechaPromesa));
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

// ---------- Próxima prestación: conectarla con el turno siguiente ----------

// Lo último que se dejó anotado para "la próxima vez" (y todavía no se
// usó para pre-cargar un turno nuevo) — se llama al escribir el nombre del
// paciente en "Nuevo turno", tanto en General como en Ortodoncia.
export async function obtenerProximaPrestacionPendiente(pacienteId, esOrtodoncia) {
  const columna = esOrtodoncia ? "paciente_ortodoncia_id" : "paciente_id";
  const { data, error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .select("id, proxima_prestacion_catalogo_id, proxima_prestacion_nombre, proxima_prestacion_tiempo_min")
    .eq(columna, pacienteId)
    .not("proxima_prestacion_nombre", "is", null)
    .eq("proxima_prestacion_usada", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Se llama al crear el turno nuevo que ya vino pre-cargado con la
// sugerencia — así no se le sigue ofreciendo la misma sugerencia a los
// turnos siguientes de ese paciente.
export async function marcarProximaPrestacionUsada(id) {
  const { error } = await supabase
    .from("prestaciones_realizadas_agenda")
    .update({ proxima_prestacion_usada: true })
    .eq("id", id);
  if (error) throw error;
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
