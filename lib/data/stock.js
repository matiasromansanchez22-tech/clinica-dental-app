import { supabase } from "@/lib/supabaseClient";

export const SECTORES_STOCK = ["Odontología General", "Tratamiento de Conducto", "Ortodoncia", "Otros"];

export async function obtenerRodantes() {
  const { data, error } = await supabase.from("stock_rodantes").select("*").order("orden");
  if (error) throw error;
  return data;
}

export async function crearRodante(nombre) {
  const { data: max } = await supabase.from("stock_rodantes").select("orden").order("orden", { ascending: false }).limit(1);
  const orden = (max?.[0]?.orden || 0) + 1;
  const { data, error } = await supabase.from("stock_rodantes").insert({ nombre, orden }).select().single();
  if (error) throw error;
  return data;
}

export async function renombrarRodante(id, nombre) {
  const { error } = await supabase.from("stock_rodantes").update({ nombre }).eq("id", id);
  if (error) throw error;
}

export async function eliminarRodante(id) {
  const { error } = await supabase.from("stock_rodantes").delete().eq("id", id);
  if (error) throw error;
}

export async function obtenerInsumosStock() {
  const { data, error } = await supabase.from("stock_insumos").select("*").order("nombre");
  if (error) throw error;
  return data;
}

export async function crearInsumoStock(nombre, sector) {
  const { data, error } = await supabase.from("stock_insumos").insert({ nombre, sector }).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarInsumoStock(id) {
  const { error } = await supabase.from("stock_insumos").delete().eq("id", id);
  if (error) throw error;
}

export async function obtenerCantidadesStock() {
  const { data, error } = await supabase.from("stock_cantidades").select("insumo_id, rodante_id, cantidad");
  if (error) throw error;
  return data;
}

export async function actualizarCantidadStock(insumoId, rodanteId, cantidad) {
  const { error } = await supabase
    .from("stock_cantidades")
    .upsert(
      { insumo_id: insumoId, rodante_id: rodanteId, cantidad: Number(cantidad) || 0, updated_at: new Date().toISOString() },
      { onConflict: "insumo_id,rodante_id" }
    );
  if (error) throw error;
}

async function sumarCantidadStock(insumoId, rodanteId, delta) {
  const { data: fila } = await supabase
    .from("stock_cantidades")
    .select("cantidad")
    .eq("insumo_id", insumoId)
    .eq("rodante_id", rodanteId)
    .maybeSingle();
  const nuevaCantidad = Number(fila?.cantidad || 0) + delta;
  await actualizarCantidadStock(insumoId, rodanteId, nuevaCantidad);
  return nuevaCantidad;
}

// Traspasa cantidad del depósito (Stock) a un rodante: resta de un lado,
// suma del otro, y deja un registro del movimiento para el resumen semanal.
export async function registrarTraspaso({ fecha, insumoId, rodanteDestinoId, cantidad, observaciones }) {
  const { data: deposito, error: errorDeposito } = await supabase
    .from("stock_rodantes")
    .select("id")
    .eq("es_deposito", true)
    .single();
  if (errorDeposito) throw errorDeposito;

  const monto = Number(cantidad) || 0;
  await sumarCantidadStock(insumoId, deposito.id, -monto);
  await sumarCantidadStock(insumoId, rodanteDestinoId, monto);

  const { error } = await supabase.from("stock_movimientos").insert({
    fecha,
    insumo_id: insumoId,
    rodante_id: rodanteDestinoId,
    cantidad: monto,
    observaciones: observaciones || null,
  });
  if (error) throw error;
}

export async function obtenerMovimientosSemana(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from("stock_movimientos")
    .select("id, fecha, cantidad, observaciones, insumo:stock_insumos(id, nombre), rodante:stock_rodantes(id, nombre)")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data;
}

export async function eliminarMovimientoStock(movimiento) {
  const { data: deposito, error: errorDeposito } = await supabase
    .from("stock_rodantes")
    .select("id")
    .eq("es_deposito", true)
    .single();
  if (errorDeposito) throw errorDeposito;

  await sumarCantidadStock(movimiento.insumo.id, deposito.id, Number(movimiento.cantidad));
  await sumarCantidadStock(movimiento.insumo.id, movimiento.rodante.id, -Number(movimiento.cantidad));

  const { error } = await supabase.from("stock_movimientos").delete().eq("id", movimiento.id);
  if (error) throw error;
}

export async function obtenerCierreSemanal(semanaInicio, semanaFin) {
  const { data, error } = await supabase
    .from("stock_cierres_semanales")
    .select("*")
    .eq("semana_inicio", semanaInicio)
    .eq("semana_fin", semanaFin)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function cerrarSemanaStock({ semanaInicio, semanaFin, detalle, nombreDuena, observaciones }) {
  const { data, error } = await supabase
    .from("stock_cierres_semanales")
    .upsert(
      {
        semana_inicio: semanaInicio,
        semana_fin: semanaFin,
        detalle,
        nombre_duena: nombreDuena || null,
        aprobado_en: new Date().toISOString(),
        observaciones: observaciones || null,
      },
      { onConflict: "semana_inicio,semana_fin" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
