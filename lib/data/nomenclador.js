import { supabase } from "@/lib/supabaseClient";

export async function obtenerObrasSociales() {
  const { data, error } = await supabase.from("obras_sociales").select("id, nombre").order("nombre");
  if (error) throw error;
  return data;
}

export async function obtenerNomencladorPorObraSocial(obraSocial, busqueda) {
  let query = supabase
    .from("nomenclador")
    .select(
      "id, obra_social, codigo, prestacion_os, valor_os, id_catalogo, prestacion_interna, copago_oficial, estado, catalogo:catalogo_prestaciones(valor_efectivo)"
    )
    .ilike("obra_social", obraSocial)
    .order("prestacion_os")
    .limit(500);

  if (busqueda) {
    query = query.or(`prestacion_os.ilike.%${busqueda}%,prestacion_interna.ilike.%${busqueda}%,codigo.ilike.%${busqueda}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data.map((f) => ({ ...f, valor_efectivo: f.catalogo?.valor_efectivo ?? null }));
}

export async function actualizarFilaNomenclador(id, cambios) {
  const { data, error } = await supabase.from("nomenclador").update(cambios).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function obtenerConfiguracionCopagoParticular() {
  const { data, error } = await supabase
    .from("configuracion_copago_particular")
    .select("porcentaje")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return Number(data.porcentaje);
}

export async function actualizarConfiguracionCopagoParticular(porcentaje) {
  const { error } = await supabase.from("configuracion_copago_particular").update({ porcentaje }).eq("id", 1);
  if (error) throw error;
}

// Recalcula copago_oficial = % del valor particular (valor_efectivo del catálogo)
// para todas las obras sociales SIN excepción propia. Las que tienen una fila en
// configuracion_copago_excepcion (ej. IAPOS) se dejan como están.
export async function recalcularCopagosSobreParticular() {
  const [{ data: config, error: e1 }, { data: excepciones, error: e2 }, { data: catalogo, error: e3 }] = await Promise.all([
    supabase.from("configuracion_copago_particular").select("porcentaje").eq("id", 1).single(),
    supabase.from("configuracion_copago_excepcion").select("obra_social"),
    supabase.from("catalogo_prestaciones").select("id, valor_efectivo"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;

  const porcentaje = Number(config.porcentaje);
  const obrasConExcepcion = new Set(excepciones.map((e) => e.obra_social));
  const valorEfectivoPorId = {};
  catalogo.forEach((c) => (valorEfectivoPorId[c.id] = Number(c.valor_efectivo)));

  let pagina = 0;
  let actualizadas = 0;
  let omitidas = 0;
  while (true) {
    const { data: filas, error } = await supabase
      .from("nomenclador")
      .select("id, obra_social, id_catalogo")
      .range(pagina * 1000, pagina * 1000 + 999);
    if (error) throw error;
    if (filas.length === 0) break;

    for (const fila of filas) {
      if (obrasConExcepcion.has(fila.obra_social)) {
        omitidas++;
        continue;
      }
      const valorEfectivo = valorEfectivoPorId[fila.id_catalogo];
      if (!valorEfectivo) {
        omitidas++;
        continue;
      }
      const nuevoCopago = Math.round((valorEfectivo * porcentaje) / 100);
      const { error: errorUpdate } = await supabase
        .from("nomenclador")
        .update({ copago_oficial: nuevoCopago })
        .eq("id", fila.id);
      if (errorUpdate) throw errorUpdate;
      actualizadas++;
    }

    if (filas.length < 1000) break;
    pagina++;
  }

  return { actualizadas, omitidas };
}

export async function obtenerEscalasCopago() {
  const { data, error } = await supabase
    .from("configuracion_copago_escala")
    .select("*")
    .order("orden");
  if (error) throw error;
  return data;
}

export async function actualizarEscalaCopago(id, porcentaje) {
  const { error } = await supabase.from("configuracion_copago_escala").update({ porcentaje }).eq("id", id);
  if (error) throw error;
}

export async function obtenerExcepcionesCopago() {
  const { data, error } = await supabase
    .from("configuracion_copago_excepcion")
    .select("*")
    .order("obra_social");
  if (error) throw error;
  return data;
}

export async function actualizarExcepcionCopago(id, cambios) {
  const { error } = await supabase.from("configuracion_copago_excepcion").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function crearExcepcionCopago({ obraSocial, porcentaje, observaciones }) {
  const { error } = await supabase
    .from("configuracion_copago_excepcion")
    .insert({ obra_social: obraSocial, porcentaje, observaciones: observaciones || null });
  if (error) throw error;
}

export async function eliminarExcepcionCopago(id) {
  const { error } = await supabase.from("configuracion_copago_excepcion").delete().eq("id", id);
  if (error) throw error;
}

// Aplica el % de excepción de una obra social directo sobre su valor_os
// (no depende de que la prestación esté vinculada al catálogo interno,
// a diferencia de recalcularCopagosSobreParticular).
export async function aplicarPorcentajeExcepcion(obraSocial, porcentaje) {
  let pagina = 0;
  let actualizadas = 0;
  while (true) {
    const { data: filas, error } = await supabase
      .from("nomenclador")
      .select("id, valor_os")
      .ilike("obra_social", obraSocial)
      .range(pagina * 1000, pagina * 1000 + 999);
    if (error) throw error;
    if (filas.length === 0) break;

    for (const fila of filas) {
      const nuevoCopago = Math.round((Number(fila.valor_os) * porcentaje) / 100);
      const { error: errorUpdate } = await supabase
        .from("nomenclador")
        .update({ copago_oficial: nuevoCopago })
        .eq("id", fila.id);
      if (errorUpdate) throw errorUpdate;
      actualizadas++;
    }

    if (filas.length < 1000) break;
    pagina++;
  }
  return { actualizadas };
}
