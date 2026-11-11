import { supabase } from "@/lib/supabaseClient";

// Para la Agenda de Odontología General: marca en cada turno si el paciente tiene un presupuesto y/o un plan de financiación en curso,
// con una sola consulta por tanda de pacientes (igual que la marca del consentimiento).
//   turno.presupuesto       = { estado: "Pendiente" | "Aceptado", numero } | null   (null = no tiene; undefined = no se pudo saber)
//   turno.planFinanciacion  = { enMora: boolean, numero } | null
// Reglas:
//  · Presupuesto "Pendiente" (todavía no lo aceptó): se muestra siempre.
//  · Presupuesto "Aceptado": se muestra solo si no tiene un plan de financiación (cuando hay plan, el plan lo reemplaza).
//  · Solo cuentan los presupuestos de los últimos 12 meses (los más viejos ya no son un tratamiento en curso).
//  · Plan de financiación: el que está Activo o En Mora y todavía tiene saldo por cobrar.
// Si algo falla (por ejemplo por permisos) la Agenda no se rompe: ese dato queda sin marca.

function haceUnAnio() {
  const f = new Date(Date.now() - 3 * 60 * 60 * 1000);
  f.setUTCFullYear(f.getUTCFullYear() - 1);
  return f.toISOString().slice(0, 10);
}

export async function conMarcaDePresupuesto(turnos) {
  const ids = [...new Set(turnos.map((t) => t.pacienteId).filter(Boolean))];
  if (ids.length === 0) return turnos;

  const planes = new Map(); // pacienteId -> { enMora, numero }
  const presupuestos = new Map(); // pacienteId -> { estado, numero }
  let planesOk = true;
  let presupuestosOk = true;
  const desde = haceUnAnio();

  for (let i = 0; i < ids.length; i += 100) {
    const tanda = ids.slice(i, i + 100);
    const [{ data: pl, error: ep }, { data: pr, error: er }] = await Promise.all([
      supabase
        .from("planes_financiacion")
        .select("paciente_id, estado_plan, numero_plan")
        .in("paciente_id", tanda)
        .in("estado_plan", ["Activo", "En Mora"])
        .gt("saldo_pendiente", 0),
      supabase
        .from("presupuestos")
        .select("paciente_id, estado, numero, fecha")
        .in("paciente_id", tanda)
        .in("estado", ["Pendiente", "Aceptado"])
        .gte("fecha", desde)
        .order("fecha", { ascending: false }),
    ]);
    if (ep) planesOk = false;
    else
      for (const p of pl) {
        const actual = planes.get(p.paciente_id);
        // Si tiene más de un plan, el que está En Mora es el que importa.
        if (!actual || (p.estado_plan === "En Mora" && !actual.enMora)) planes.set(p.paciente_id, { enMora: p.estado_plan === "En Mora", numero: p.numero_plan });
      }
    if (er) presupuestosOk = false;
    else
      for (const p of pr) {
        const actual = presupuestos.get(p.paciente_id);
        // Gana el Pendiente; entre iguales, el más nuevo (la lista ya viene del más nuevo al más viejo).
        if (!actual || (p.estado === "Pendiente" && actual.estado !== "Pendiente")) presupuestos.set(p.paciente_id, { estado: p.estado, numero: p.numero });
      }
  }

  return turnos.map((t) => {
    if (!t.pacienteId) return t;
    const plan = planesOk ? planes.get(t.pacienteId) || null : undefined;
    let presupuesto = presupuestosOk ? presupuestos.get(t.pacienteId) || null : undefined;
    if (presupuesto?.estado === "Aceptado" && plan) presupuesto = null;
    return { ...t, planFinanciacion: plan, presupuesto };
  });
}
