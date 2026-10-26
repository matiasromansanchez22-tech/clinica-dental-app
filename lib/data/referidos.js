import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";

// Plan de referidos de Ortodoncia (ver migración 174).
//  · Referido: paciente nuevo que llegó recomendado por un paciente nuestro. Tiene un descuento en su instalación
//    ($30.000 si paga todo de contado, $20.000 menos en la primera cuota si paga en 2).
//  · Referidor: el paciente que lo recomendó. Cuando el referido comienza la instalación (primer cobro de instalación),
//    queda con un descuento en un control (la mitad; cada 3.er referido, un control sin costo). Tope de 3 premios por año
//    y vigencia de 90 días.

export const CONFIG_REFERIDOS_POR_DEFECTO = {
  referidos_descuento_instalacion_contado: 30000,
  referidos_descuento_instalacion_2_cuotas: 20000,
  referidos_porcentaje_descuento_control: 50,
  referidos_cada_cuantos_control_sin_costo: 3,
  referidos_tope_premios_por_anio: 3,
  referidos_vigencia_dias: 90,
};

const SELECT_REFERIDO = `id, referidor_id, referido_id, fecha_registro, fecha_instalacion,
  premio_referido_estado, premio_referido_monto, premio_referido_aplicado_en,
  premio_referidor_estado, premio_referidor_tipo, premio_referidor_habilitado_en, premio_referidor_vence,
  premio_referidor_monto, premio_referidor_aplicado_en, observaciones, created_at,
  referidor:pacientes_ortodoncia!referidor_id(nombre),
  referido:pacientes_ortodoncia!referido_id(nombre)`;

function mapear(f) {
  return {
    id: f.id,
    referidorId: f.referidor_id,
    referidoId: f.referido_id,
    referidor: f.referidor?.nombre ?? "—",
    referido: f.referido?.nombre ?? "—",
    fechaRegistro: f.fecha_registro,
    fechaInstalacion: f.fecha_instalacion,
    premioReferidoEstado: f.premio_referido_estado,
    premioReferidoMonto: f.premio_referido_monto,
    premioReferidoAplicadoEn: f.premio_referido_aplicado_en,
    premioReferidorEstado: f.premio_referidor_estado,
    premioReferidorTipo: f.premio_referidor_tipo,
    premioReferidorHabilitadoEn: f.premio_referidor_habilitado_en,
    premioReferidorVence: f.premio_referidor_vence,
    premioReferidorMonto: f.premio_referidor_monto,
    premioReferidorAplicadoEn: f.premio_referidor_aplicado_en,
    observaciones: f.observaciones,
  };
}

function sumarDias(fechaISO, dias) {
  const d = new Date(`${fechaISO}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function obtenerConfigReferidos() {
  const { data, error } = await supabase.from("configuracion_ortodoncia").select("clave, valor").like("clave", "referidos_%");
  if (error) throw error;
  const cfg = { ...CONFIG_REFERIDOS_POR_DEFECTO };
  for (const f of data) cfg[f.clave] = Number(f.valor);
  return cfg;
}

// Todos los referidos (para la pantalla de Referidos). Los premios vencidos se marcan solos.
export async function obtenerReferidos() {
  const { data, error } = await supabase.from("referidos_ortodoncia").select(SELECT_REFERIDO).order("fecha_registro", { ascending: false });
  if (error) throw error;
  const hoy = fechaDeHoyISO();
  const filas = data.map(mapear);
  const vencidos = filas.filter((r) => r.premioReferidorEstado === "Habilitado" && r.premioReferidorVence && r.premioReferidorVence < hoy);
  if (vencidos.length > 0) {
    await supabase.from("referidos_ortodoncia").update({ premio_referidor_estado: "Vencido" }).in("id", vencidos.map((r) => r.id));
    vencidos.forEach((r) => (r.premioReferidorEstado = "Vencido"));
  }
  return filas;
}

// Quién recomendó a este paciente (si alguien) y a quiénes recomendó él.
export async function obtenerReferidosDePaciente(pacienteId) {
  const [comoReferido, comoReferidor] = await Promise.all([
    supabase.from("referidos_ortodoncia").select(SELECT_REFERIDO).eq("referido_id", pacienteId).maybeSingle(),
    supabase.from("referidos_ortodoncia").select(SELECT_REFERIDO).eq("referidor_id", pacienteId).order("fecha_registro"),
  ]);
  if (comoReferido.error) throw comoReferido.error;
  if (comoReferidor.error) throw comoReferidor.error;
  return { vinoPor: comoReferido.data ? mapear(comoReferido.data) : null, recomendo: (comoReferidor.data || []).map(mapear) };
}

// Deja registrado (o cambia, o saca) quién recomendó al paciente. Si el premio del referido ya se aplicó, no se puede cambiar.
export async function guardarReferidor(pacienteId, referidorId) {
  const { data: actual, error } = await supabase.from("referidos_ortodoncia").select("id, referidor_id, premio_referido_estado, fecha_instalacion").eq("referido_id", pacienteId).maybeSingle();
  if (error) throw error;
  if (!referidorId) {
    if (actual) {
      if (actual.premio_referido_estado === "Aplicado" || actual.fecha_instalacion) {
        throw new Error("No se puede sacar el referido: este paciente ya empezó la instalación o ya usó el descuento.");
      }
      const { error: e } = await supabase.from("referidos_ortodoncia").delete().eq("id", actual.id);
      if (e) throw e;
    }
    return;
  }
  if (referidorId === pacienteId) throw new Error("Un paciente no puede recomendarse a sí mismo.");
  if (actual) {
    if (actual.referidor_id === referidorId) return;
    if (actual.premio_referido_estado === "Aplicado" || actual.fecha_instalacion) {
      throw new Error("No se puede cambiar quién lo recomendó: este paciente ya empezó la instalación o ya usó el descuento.");
    }
    const { error: e } = await supabase.from("referidos_ortodoncia").update({ referidor_id: referidorId }).eq("id", actual.id);
    if (e) throw e;
    return;
  }
  const { error: e } = await supabase.from("referidos_ortodoncia").insert({ referidor_id: referidorId, referido_id: pacienteId });
  if (e) throw e;
}

// Premios que tiene disponibles un paciente para usar en un cobro.
//  · como referido: descuento en la instalación (de contado: monto completo; en 2 cuotas: solo en la primera cuota).
//  · como referidor: descuento en un control (el más antiguo habilitado y vigente).
export async function obtenerPremiosDisponibles(pacienteId, cfg) {
  const hoy = fechaDeHoyISO();
  const { vinoPor, recomendo } = await obtenerReferidosDePaciente(pacienteId);
  const referido =
    vinoPor && vinoPor.premioReferidoEstado === "Pendiente"
      ? {
          id: vinoPor.id,
          referidor: vinoPor.referidor,
          montoContado: cfg.referidos_descuento_instalacion_contado,
          monto2Cuotas: cfg.referidos_descuento_instalacion_2_cuotas,
        }
      : null;
  const vigentes = recomendo
    .filter((r) => r.premioReferidorEstado === "Habilitado" && (!r.premioReferidorVence || r.premioReferidorVence >= hoy))
    .sort((a, b) => (a.premioReferidorHabilitadoEn || "").localeCompare(b.premioReferidorHabilitadoEn || ""));
  const referidor = vigentes[0]
    ? {
        id: vigentes[0].id,
        referido: vigentes[0].referido,
        tipo: vigentes[0].premioReferidorTipo,
        vence: vigentes[0].premioReferidorVence,
        cantidad: vigentes.length,
        porcentaje: cfg.referidos_porcentaje_descuento_control,
      }
    : null;
  return { referido, referidor };
}

// Cuánto vale el descuento del referidor para un control de esa cuota (redondeado a $100).
export function montoDescuentoControl(premioReferidor, cuota) {
  if (!premioReferidor || !cuota) return 0;
  if (premioReferidor.tipo === "Control sin costo") return Math.round(Number(cuota));
  return Math.round((Number(cuota) * Number(premioReferidor.porcentaje || 50)) / 100 / 100) * 100;
}

// Después de guardar un cobro con descuento: el premio queda como aplicado (no se puede usar dos veces).
export async function marcarPremioAplicado({ referidoRefId, rol, monto, cajaOrtodonciaId, fecha }) {
  const cambios =
    rol === "referido"
      ? { premio_referido_estado: "Aplicado", premio_referido_monto: monto, premio_referido_aplicado_en: fecha, premio_referido_cobro_id: cajaOrtodonciaId }
      : { premio_referidor_estado: "Aplicado", premio_referidor_monto: monto, premio_referidor_aplicado_en: fecha, premio_referidor_cobro_id: cajaOrtodonciaId };
  const { error } = await supabase.from("referidos_ortodoncia").update(cambios).eq("id", referidoRefId);
  if (error) throw error;
}

// Cuando se registra el primer cobro de instalación de un paciente que llegó recomendado: el referidor queda con su
// premio habilitado (mitad de un control, o control sin costo cada 3.er referido), salvo que ya haya llegado al tope del año.
export async function registrarInicioInstalacionReferido(pacienteId, fecha) {
  const { data: ref, error } = await supabase.from("referidos_ortodoncia").select("id, referidor_id, fecha_instalacion").eq("referido_id", pacienteId).maybeSingle();
  if (error) throw error;
  if (!ref || ref.fecha_instalacion) return null;
  const cfg = await obtenerConfigReferidos();
  const anio = fecha.slice(0, 4);
  const { data: delReferidor, error: e2 } = await supabase.from("referidos_ortodoncia").select("id, fecha_instalacion, premio_referidor_estado").eq("referidor_id", ref.referidor_id).not("fecha_instalacion", "is", null);
  if (e2) throw e2;
  const conPremioEsteAnio = delReferidor.filter((r) => r.premio_referidor_estado !== "Sin premio" && r.premio_referidor_estado !== "En espera" && String(r.fecha_instalacion).startsWith(anio)).length;
  const numero = delReferidor.length + 1; // este es el N.º referido del paciente que empieza el tratamiento
  const cambios = { fecha_instalacion: fecha };
  if (conPremioEsteAnio >= cfg.referidos_tope_premios_por_anio) {
    cambios.premio_referidor_estado = "Sin premio";
    cambios.observaciones = "Superó el tope de premios del año.";
  } else {
    cambios.premio_referidor_estado = "Habilitado";
    cambios.premio_referidor_tipo = numero % cfg.referidos_cada_cuantos_control_sin_costo === 0 ? "Control sin costo" : "Mitad de un control";
    cambios.premio_referidor_habilitado_en = fecha;
    cambios.premio_referidor_vence = sumarDias(fecha, cfg.referidos_vigencia_dias);
  }
  const { error: e3 } = await supabase.from("referidos_ortodoncia").update(cambios).eq("id", ref.id);
  if (e3) throw e3;
  return cambios;
}
