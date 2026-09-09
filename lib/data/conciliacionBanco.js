import { supabase } from "@/lib/supabaseClient";

function mapearFila(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    cuenta: f.cuenta,
    saldoSistema: Number(f.saldo_sistema),
    saldoReal: Number(f.saldo_real),
    diferencia: Number(f.diferencia),
    observaciones: f.observaciones,
    createdAt: f.created_at,
  };
}

// Últimas conciliaciones (para el historial y para mostrar la más
// reciente de un vistazo, sin tener que abrir nada).
export async function obtenerConciliacionesBanco(limite = 10) {
  const { data, error } = await supabase
    .from("conciliaciones_banco")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data.map(mapearFila);
}

export async function registrarConciliacionBanco({ cuenta, saldoSistema, saldoReal, observaciones }) {
  const diferencia = Number(saldoReal) - Number(saldoSistema);
  const { data, error } = await supabase
    .from("conciliaciones_banco")
    .insert({
      cuenta,
      saldo_sistema: Number(saldoSistema),
      saldo_real: Number(saldoReal),
      diferencia,
      observaciones: observaciones || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}
