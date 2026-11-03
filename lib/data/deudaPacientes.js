import { supabase } from "@/lib/supabaseClient";

// Cuánto debe cada paciente de Odontología General: cobros con saldo pendiente + lo que falta de sus planes de
// financiación (ver migración 185). Devuelve { [pacienteId]: { saldoCobros, saldoPlan, total } }.
// Si el usuario no tiene permiso para ver deudas, la función no devuelve a nadie: ese paciente no figura en el
// resultado (y NO debe tratarse como «no debe nada»).
export async function obtenerDeudaDePacientes(pacienteIds) {
  const ids = [...new Set((pacienteIds || []).filter(Boolean))];
  const mapa = {};
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.rpc("deuda_de_pacientes", { p_ids: ids.slice(i, i + 200) });
    if (error) throw error;
    for (const f of data) {
      const saldoCobros = Number(f.saldo_cobros) || 0;
      const saldoPlan = Number(f.saldo_plan) || 0;
      mapa[f.paciente_id] = { saldoCobros, saldoPlan, total: saldoCobros + saldoPlan };
    }
  }
  return mapa;
}

export function textoDeuda(deuda) {
  const partes = [];
  if (deuda.saldoCobros > 0) partes.push(`cobros pendientes $${Math.round(deuda.saldoCobros).toLocaleString("es-AR")}`);
  if (deuda.saldoPlan > 0) partes.push(`plan de financiación $${Math.round(deuda.saldoPlan).toLocaleString("es-AR")}`);
  return partes.join(" + ");
}
