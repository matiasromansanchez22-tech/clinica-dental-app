import { supabase } from "@/lib/supabaseClient";

// Rutina de trabajo del equipo (migración 207): tildar lo que se hizo, marcar «Visto» (Dueñas) y editar hojas, tareas y quién tiene cada hoja.

function revisar(error) {
  if (!error) return;
  if (/relation|does not exist|schema cache/i.test(error.message || "")) throw new Error("Falta correr la migración 207 en Supabase.");
  throw error;
}

export async function tildarTarea({ tareaId, fecha, valor = null }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");
  const { data, error } = await supabase
    .from("rutina_equipo_tildes")
    .insert({ tarea_id: tareaId, usuario_id: user.id, fecha, valor: valor === null || valor === "" ? null : String(valor).trim() })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return null; // ya estaba tildada
    if (error.code === "42501") throw new Error("Solo se puede tildar el día de hoy.");
    revisar(error);
  }
  return data;
}

export async function destildarTarea(tildeId) {
  const { data, error } = await supabase.from("rutina_equipo_tildes").delete().eq("id", tildeId).select("id");
  revisar(error);
  if (!data?.length) throw new Error("Esta tarea ya no se puede destildar (pasó el día o una Dueña ya la vio).");
}

// Dueñas: marcar (o sacar) «Visto» de una tarea declarada.
export async function marcarVisto(tildeId, visto) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("rutina_equipo_tildes")
    .update({ visto_por: visto ? user?.id ?? null : null, visto_en: visto ? new Date().toISOString() : null })
    .eq("id", tildeId);
  revisar(error);
}

// Dueñas: marcar «Visto» de todas las tareas declaradas de una persona ese día.
export async function marcarVistoTodas(tildeIds) {
  if (!tildeIds.length) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("rutina_equipo_tildes").update({ visto_por: user?.id ?? null, visto_en: new Date().toISOString() }).in("id", tildeIds);
  revisar(error);
}

// Porcentaje de tareas hechas por día de una persona o de todas, para ver la semana. Cuenta solo tildes (lo comprobado por el sistema se
// ve en el control de cada día).
export async function obtenerTildesDeRango(desde, hasta) {
  const { data, error } = await supabase.from("rutina_equipo_tildes").select("usuario_id, fecha, tarea_id").gte("fecha", desde).lte("fecha", hasta);
  revisar(error);
  return data;
}

// ---- Configuración (Dueñas) ----
export async function obtenerConfiguracion() {
  const [hojas, tareas, asig, perfiles] = await Promise.all([
    supabase.from("rutina_equipo_hojas").select("*").order("orden"),
    supabase.from("rutina_equipo_tareas").select("*").order("orden"),
    supabase.from("rutina_equipo_asignaciones").select("usuario_id, hoja_id"),
    supabase.from("perfiles").select("id, nombre, rol").order("nombre"),
  ]);
  for (const r of [hojas, tareas, asig, perfiles]) revisar(r.error);
  return { hojas: hojas.data, tareas: tareas.data, asignaciones: asig.data, perfiles: perfiles.data };
}

export async function guardarTarea({ id, hojaId, momento, texto, orden, verificacion, pideValor, activa = true }) {
  const fila = { hoja_id: hojaId, momento: momento.trim(), texto: texto.trim(), orden: Number(orden) || 0, verificacion: verificacion || null, pide_valor: pideValor?.trim() || null, activa };
  const { error } = id ? await supabase.from("rutina_equipo_tareas").update(fila).eq("id", id) : await supabase.from("rutina_equipo_tareas").insert(fila);
  revisar(error);
}

export async function asignarHoja(usuarioId, hojaId) {
  if (!hojaId) {
    const { error } = await supabase.from("rutina_equipo_asignaciones").delete().eq("usuario_id", usuarioId);
    return revisar(error);
  }
  const { error } = await supabase.from("rutina_equipo_asignaciones").upsert({ usuario_id: usuarioId, hoja_id: hojaId }, { onConflict: "usuario_id" });
  revisar(error);
}
