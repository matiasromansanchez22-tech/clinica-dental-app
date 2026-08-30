import { supabase } from "@/lib/supabaseClient";

// Mueve a la papelera todas las filas de "tabla" que matchean "filtro"
// (un id string, o un objeto {columna: valor} para casos con clave
// compuesta) — guarda una copia completa y recién ahí borra el original.
export async function moverAPapelera(tabla, filtro) {
  const columnas = typeof filtro === "string" ? { id: filtro } : filtro;

  let consulta = supabase.from(tabla).select("*");
  for (const [columna, valor] of Object.entries(columnas)) consulta = consulta.eq(columna, valor);
  const { data: filas, error: errorSelect } = await consulta;
  if (errorSelect) throw errorSelect;
  if (!filas || filas.length === 0) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const registros = filas.map((fila) => ({
    tabla,
    registro_id: fila.id,
    datos: fila,
    borrado_por: user?.id ?? null,
  }));
  const { error: errorInsert } = await supabase.from("papelera").insert(registros);
  if (errorInsert) throw errorInsert;

  let borrado = supabase.from(tabla).delete();
  for (const [columna, valor] of Object.entries(columnas)) borrado = borrado.eq(columna, valor);
  const { error: errorDelete } = await borrado;
  if (errorDelete) throw errorDelete;
}

export async function obtenerPapelera() {
  const { data, error } = await supabase.from("papelera").select("*").order("borrado_en", { ascending: false });
  if (error) throw error;
  return data;
}

export async function restaurarDePapelera(papeleraId) {
  const { data: fila, error: errorGet } = await supabase.from("papelera").select("*").eq("id", papeleraId).single();
  if (errorGet) throw errorGet;
  const { error: errorInsert } = await supabase.from(fila.tabla).insert(fila.datos);
  if (errorInsert) throw errorInsert;
  const { error: errorDelete } = await supabase.from("papelera").delete().eq("id", papeleraId);
  if (errorDelete) throw errorDelete;
}

export async function eliminarDefinitivo(papeleraId) {
  const { error } = await supabase.from("papelera").delete().eq("id", papeleraId);
  if (error) throw error;
}

// Se llama cada vez que se abre la pantalla de la papelera: lo que ya
// cumplió el plazo se borra solo, sin que nadie tenga que vaciarla a mano.
export async function vaciarPapeleraVieja(dias = 30) {
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);
  const { error } = await supabase.from("papelera").delete().lt("borrado_en", limite.toISOString());
  if (error) throw error;
}
