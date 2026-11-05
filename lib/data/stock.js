import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";
import { avisarInsumosParaComprar, avisarPocoStock, avisarTraspasoARodante } from "@/lib/data/avisos";

export const SECTORES_STOCK = [
  "Odontología General",
  "Tratamiento de Conducto",
  "Ortodoncia",
  "Insumos descartables",
  "Otros",
];

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
  await moverAPapelera("stock_rodantes", id);
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

// Cuánto queda en el Stock (depósito) de cada insumo que tiene mínimo cargado, y cuáles están en o por debajo del mínimo.
export async function obtenerInsumosConMinimo() {
  const { data: insumos, error } = await supabase
    .from("stock_insumos")
    .select("id, nombre, sector, stock_minimo, aviso_stock_bajo")
    .not("stock_minimo", "is", null);
  if (error) throw error;
  if (!insumos.length) return [];
  const deposito = await obtenerRodanteDeposito();
  const { data: cantidades, error: errorCantidades } = await supabase
    .from("stock_cantidades")
    .select("insumo_id, cantidad")
    .eq("rodante_id", deposito.id);
  if (errorCantidades) throw errorCantidades;
  const porInsumo = {};
  for (const c of cantidades) porInsumo[c.insumo_id] = Number(c.cantidad);
  return insumos.map((i) => ({
    id: i.id,
    nombre: i.nombre,
    sector: i.sector,
    minimo: Number(i.stock_minimo),
    enStock: porInsumo[i.id] || 0,
    avisado: i.aviso_stock_bajo,
    bajo: (porInsumo[i.id] || 0) <= Number(i.stock_minimo),
  }));
}

// Se llama después de cualquier cambio en el Stock. Avisa UNA vez cuando un insumo baja de su mínimo y apaga la marca
// cuando se repone (para que vuelva a avisar la próxima). Nunca rompe lo que se estaba haciendo.
export async function revisarStockBajo() {
  try {
    const insumos = await obtenerInsumosConMinimo();
    const nuevos = insumos.filter((i) => i.bajo && !i.avisado);
    const repuestos = insumos.filter((i) => !i.bajo && i.avisado);
    if (repuestos.length) {
      await supabase.from("stock_insumos").update({ aviso_stock_bajo: false }).in("id", repuestos.map((i) => i.id));
    }
    if (nuevos.length) {
      // La marca se pone primero y solo avisa de los que logró marcar: si dos personas cargan a la vez, no sale doble.
      const { data: marcados } = await supabase
        .from("stock_insumos")
        .update({ aviso_stock_bajo: true })
        .in("id", nuevos.map((i) => i.id))
        .eq("aviso_stock_bajo", false)
        .select("id");
      const ids = new Set((marcados || []).map((m) => m.id));
      avisarPocoStock(nuevos.filter((i) => ids.has(i.id)));
    }
  } catch {
    // sin conexión o sin la migración todavía: no pasa nada
  }
}

export async function actualizarMinimoInsumo(id, valor) {
  const minimo = valor === "" || valor == null ? null : Math.max(0, Number(valor) || 0);
  const { data, error } = await supabase.from("stock_insumos").update({ stock_minimo: minimo }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function actualizarInsumoStock(id, { nombre, sector, observaciones }) {
  const { data, error } = await supabase
    .from("stock_insumos")
    .update({ nombre, sector, observaciones: observaciones || null })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarInsumoStock(id) {
  await moverAPapelera("stock_insumos", id);
}

// ---------- Lista de insumos para comprar ----------
export async function obtenerListaComprasInsumos() {
  const { data, error } = await supabase
    .from("stock_lista_compras")
    .select("*")
    .eq("estado", "Pendiente")
    .order("urgente", { ascending: false })
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function agregarItemCompraInsumo({ nombre, insumoId, cantidad, notas, urgente, pedidoPorNombre }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("stock_lista_compras")
    .insert({
      nombre,
      insumo_id: insumoId || null,
      cantidad: Number(cantidad) || 1,
      notas: notas?.trim() || null,
      urgente: Boolean(urgente),
      pedido_por: user?.id || null,
      pedido_por_nombre: pedidoPorNombre || null,
    })
    .select()
    .single();
  if (error) throw error;
  avisarInsumosParaComprar({ nombre, cantidad: data.cantidad, urgente: data.urgente, quien: pedidoPorNombre });
  return data;
}

export async function marcarCompradoItemInsumo(id) {
  const { error } = await supabase.from("stock_lista_compras").update({ estado: "Comprado", comprado_en: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function quitarItemCompraInsumo(id) {
  await moverAPapelera("stock_lista_compras", id);
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

export async function obtenerRodanteDeposito() {
  const { data, error } = await supabase.from("stock_rodantes").select("*").eq("es_deposito", true).single();
  if (error) throw error;
  return data;
}

export async function sumarCantidadStock(insumoId, rodanteId, delta) {
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
  // Aviso a las dueñas de qué rodante se completó y con qué (nunca frena el traspaso).
  try {
    const [{ data: ins }, { data: rod }] = await Promise.all([
      supabase.from("stock_insumos").select("nombre").eq("id", insumoId).maybeSingle(),
      supabase.from("stock_rodantes").select("nombre").eq("id", rodanteDestinoId).maybeSingle(),
    ]);
    if (ins?.nombre && rod?.nombre) avisarTraspasoARodante({ rodante: rod.nombre, insumo: ins.nombre, cantidad: monto });
  } catch {
    // sin aviso, nada más
  }
  await revisarStockBajo();
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

  await moverAPapelera("stock_movimientos", movimiento.id);
  await revisarStockBajo();
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
