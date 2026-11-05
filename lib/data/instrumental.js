import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";
import { agregarItemCompraInsumo } from "@/lib/data/stock";
import { enviarAviso } from "@/lib/data/avisos";

// Las dos áreas se llevan por separado: cada una tiene su propio instrumental (puede repetirse el nombre) y sus categorías.
export const AREAS_INSTRUMENTAL = ["Odontología General", "Ortodoncia"];
export const CATEGORIAS_POR_AREA = {
  "Odontología General": [
    "Diagnóstico y exploración",
    "Operatoria y restauradora",
    "Cirugía y periodoncia",
    "Conducto",
    "Prótesis",
    "Esterilización y bandejas",
    "Otros",
  ],
  Ortodoncia: ["Alicates", "Pinzas y cementado", "Diagnóstico y medición", "Esterilización y bandejas", "Otros"],
};
const sufijoArea = (area) => (area === "Ortodoncia" ? " (Ortodoncia)" : "");

// Qué hace cada tipo de novedad con las cantidades de la ubicación.
//   buenos / aReparar: cambio en esa ubicación (origen). "Movido" además suma en el destino.
export const TIPOS_NOVEDAD = {
  Roto: { buenos: -1, aReparar: 0, avisa: true, ayuda: "Se rompió y no se puede usar: sale del inventario." },
  Perdido: { buenos: -1, aReparar: 0, avisa: true, ayuda: "No aparece: sale del inventario." },
  "A reparar": { buenos: -1, aReparar: 1, avisa: true, ayuda: "Se manda a arreglar o afilar: queda como 'para reparar'." },
  Reparado: { buenos: 1, aReparar: -1, avisa: false, ayuda: "Volvió de arreglo: pasa de 'para reparar' a bueno." },
  Repuesto: { buenos: 1, aReparar: 0, avisa: false, ayuda: "Se compró o llegó uno nuevo: suma al inventario." },
  Movido: { buenos: -1, aReparar: 0, avisa: false, ayuda: "Se cambió de ubicación (de dónde a dónde)." },
};

export async function obtenerUbicacionesInstrumental() {
  const { data, error } = await supabase.from("instrumental_ubicaciones").select("*").order("orden").order("nombre");
  if (error) throw error;
  return data;
}

export async function crearUbicacionInstrumental(nombre) {
  const { data: max } = await supabase.from("instrumental_ubicaciones").select("orden").order("orden", { ascending: false }).limit(1);
  const { data, error } = await supabase
    .from("instrumental_ubicaciones")
    .insert({ nombre: nombre.trim(), orden: (max?.[0]?.orden || 0) + 1 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function obtenerItemsInstrumental() {
  const { data, error } = await supabase.from("instrumental_items").select("*").order("nombre");
  if (error) throw error;
  return data;
}

export async function obtenerCantidadesInstrumental() {
  const { data, error } = await supabase.from("instrumental_cantidades").select("item_id, ubicacion_id, buenos, a_reparar");
  if (error) throw error;
  return data;
}

async function usuarioActual() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

// Cambia las cantidades de un instrumental en una ubicación (nunca por debajo de cero).
async function sumarCantidades(itemId, ubicacionId, deltaBuenos, deltaReparar) {
  const { data: fila, error } = await supabase
    .from("instrumental_cantidades")
    .select("buenos, a_reparar")
    .eq("item_id", itemId)
    .eq("ubicacion_id", ubicacionId)
    .maybeSingle();
  if (error) throw error;
  const buenos = (fila?.buenos || 0) + deltaBuenos;
  const aReparar = (fila?.a_reparar || 0) + deltaReparar;
  if (buenos < 0 || aReparar < 0) {
    throw new Error("No hay suficientes unidades en esa ubicación para registrar eso.");
  }
  const { error: errorUpsert } = await supabase
    .from("instrumental_cantidades")
    .upsert({ item_id: itemId, ubicacion_id: ubicacionId, buenos, a_reparar: aReparar }, { onConflict: "item_id,ubicacion_id" });
  if (errorUpsert) throw errorUpsert;
}

export async function crearItemInstrumental({ nombre, categoria, observaciones, ubicacionId, cantidad, quien, area }) {
  const { data: item, error } = await supabase
    .from("instrumental_items")
    .insert({ nombre: nombre.trim(), categoria: categoria || "Otros", observaciones: observaciones?.trim() || null, area: area || "Odontología General" })
    .select()
    .single();
  if (error) throw error.code === "23505" ? new Error(`"${nombre.trim()}" ya está en el inventario de ${area || "Odontología General"}.`) : error;
  const unidades = Math.max(0, Math.floor(Number(cantidad) || 0));
  if (unidades > 0 && ubicacionId) {
    await sumarCantidades(item.id, ubicacionId, unidades, 0);
    const { error: errorNovedad } = await supabase.from("instrumental_novedades").insert({
      item_id: item.id,
      ubicacion_id: ubicacionId,
      tipo: "Alta",
      cantidad: unidades,
      nota: "Alta inicial en el inventario",
      registrado_por: await usuarioActual(),
      registrado_por_nombre: quien || null,
    });
    if (errorNovedad) throw errorNovedad;
  }
  return item;
}

export async function actualizarItemInstrumental(id, { nombre, categoria, observaciones, area }) {
  const { data, error } = await supabase
    .from("instrumental_items")
    .update({ nombre: nombre.trim(), categoria, observaciones: observaciones?.trim() || null, area: area || "Odontología General" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Solo se puede quitar un instrumental que ya no tiene unidades (si no, se perdería el rastro de lo que había).
export async function quitarItemInstrumental(id) {
  const { data, error } = await supabase.from("instrumental_cantidades").select("buenos, a_reparar").eq("item_id", id);
  if (error) throw error;
  const unidades = (data || []).reduce((a, c) => a + c.buenos + c.a_reparar, 0);
  if (unidades > 0) throw new Error("Todavía tiene unidades en el inventario. Registrá primero las novedades (roto, perdido...) y recién después se puede quitar.");
  await moverAPapelera("instrumental_items", id);
}

export async function registrarNovedadInstrumental({ item, ubicacion, destino, tipo, cantidad, nota, comprarReposicion, quien }) {
  const regla = TIPOS_NOVEDAD[tipo];
  if (!regla) throw new Error("Tipo de novedad desconocido.");
  const unidades = Math.floor(Number(cantidad) || 0);
  if (unidades <= 0) throw new Error("La cantidad tiene que ser al menos 1.");
  if (tipo === "Movido" && (!destino || destino.id === ubicacion.id)) throw new Error("Elegí a qué ubicación se movió.");

  await sumarCantidades(item.id, ubicacion.id, regla.buenos * unidades, regla.aReparar * unidades);
  if (tipo === "Movido") await sumarCantidades(item.id, destino.id, unidades, 0);

  const { error } = await supabase.from("instrumental_novedades").insert({
    item_id: item.id,
    ubicacion_id: ubicacion.id,
    ubicacion_destino_id: tipo === "Movido" ? destino.id : null,
    tipo,
    cantidad: unidades,
    nota: nota?.trim() || null,
    registrado_por: await usuarioActual(),
    registrado_por_nombre: quien || null,
  });
  if (error) throw error;

  if (regla.avisa) {
    enviarAviso({
      titulo: `🔧 Instrumental ${tipo === "A reparar" ? "para reparar" : tipo.toLowerCase()}${sufijoArea(item.area)}${quien ? ` — ${quien}` : ""}`,
      mensaje: `${item.nombre} ×${unidades} (${ubicacion.nombre})${nota?.trim() ? ` · ${nota.trim()}` : ""}`,
      url: "/gerencial/instrumental",
      roles: ["Duena"],
    }).catch(() => {});
  }
  if (comprarReposicion && (tipo === "Roto" || tipo === "Perdido")) {
    await agregarItemCompraInsumo({
      nombre: `Instrumental: ${item.nombre}`,
      cantidad: unidades,
      notas: `Reposición (${tipo.toLowerCase()} en ${ubicacion.nombre})`,
      urgente: false,
      area: item.area,
      pedidoPorNombre: quien,
    });
  }
}

export async function obtenerNovedadesInstrumental(limite = 150) {
  const { data, error } = await supabase
    .from("instrumental_novedades")
    .select("id, fecha, tipo, cantidad, nota, registrado_por_nombre, created_at, item:instrumental_items(nombre, area), ubicacion:ubicacion_id(nombre), destino:ubicacion_destino_id(nombre)")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data;
}

// Guarda un conteo físico de una ubicación. lineas: [{ itemId, nombre, esperado, contado }].
// Si ajustar=true, el inventario queda igual a lo contado: los faltantes se registran como "Faltante en conteo" y los
// sobrantes como "Sobrante en conteo" (queda el rastro de cada diferencia).
export async function guardarConteoInstrumental({ ubicacion, lineas, ajustar, quien, area }) {
  const usuarioId = await usuarioActual();
  const diferencias = lineas.filter((l) => l.contado !== l.esperado);
  const faltantes = lineas.filter((l) => l.contado < l.esperado);
  const sobrantes = lineas.filter((l) => l.contado > l.esperado);

  if (ajustar) {
    for (const l of diferencias) {
      const delta = l.contado - l.esperado;
      await sumarCantidades(l.itemId, ubicacion.id, delta, 0);
      const { error } = await supabase.from("instrumental_novedades").insert({
        item_id: l.itemId,
        ubicacion_id: ubicacion.id,
        tipo: delta < 0 ? "Faltante en conteo" : "Sobrante en conteo",
        cantidad: Math.abs(delta),
        nota: `Conteo de ${ubicacion.nombre}: había ${l.esperado} anotados y se contaron ${l.contado}`,
        registrado_por: usuarioId,
        registrado_por_nombre: quien || null,
      });
      if (error) throw error;
    }
  }

  const { data, error } = await supabase
    .from("instrumental_conteos")
    .insert({
      ubicacion_id: ubicacion.id,
      ubicacion_nombre: ubicacion.nombre,
      realizado_por: usuarioId,
      realizado_por_nombre: quien || null,
      detalle: lineas,
      faltantes: faltantes.reduce((a, l) => a + (l.esperado - l.contado), 0),
      sobrantes: sobrantes.reduce((a, l) => a + (l.contado - l.esperado), 0),
      ajustado: Boolean(ajustar),
      area: area || "Odontología General",
    })
    .select()
    .single();
  if (error) throw error;

  if (faltantes.length > 0) {
    const lista = faltantes.map((l) => `${l.nombre} (faltan ${l.esperado - l.contado})`);
    enviarAviso({
      titulo: `🔎 Conteo de instrumental${sufijoArea(area)}: faltan cosas en ${ubicacion.nombre}${quien ? ` — ${quien}` : ""}`,
      mensaje: `${lista.slice(0, 6).join(", ")}${lista.length > 6 ? ` y ${lista.length - 6} más` : ""}`,
      url: "/gerencial/instrumental",
      roles: ["Duena"],
    }).catch(() => {});
  }
  return data;
}

export async function obtenerConteosInstrumental(limite = 20) {
  const { data, error } = await supabase.from("instrumental_conteos").select("*").order("created_at", { ascending: false }).limit(limite);
  if (error) throw error;
  return data;
}
