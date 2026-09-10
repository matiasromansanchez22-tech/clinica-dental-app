import { supabase } from "@/lib/supabaseClient";

function mapearFila(f) {
  return { id: f.id, nombre: f.nombre, mes: f.mes, dia: f.dia, observaciones: f.observaciones };
}

export async function obtenerFechasEspeciales() {
  const { data, error } = await supabase.from("fechas_especiales").select("*").order("mes").order("dia");
  if (error) throw error;
  return data.map(mapearFila);
}

export async function crearFechaEspecial(datos) {
  const { data, error } = await supabase
    .from("fechas_especiales")
    .insert({
      nombre: datos.nombre,
      mes: Number(datos.mes),
      dia: Number(datos.dia),
      observaciones: datos.observaciones || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function eliminarFechaEspecial(id) {
  const { error } = await supabase.from("fechas_especiales").delete().eq("id", id);
  if (error) throw error;
}

// Próxima ocurrencia de cada fecha especial a partir de hoy (si ya pasó
// este año, salta al año que viene) — para mostrar "lo que se viene"
// ordenado por cercanía, sin importar en qué mes estemos parados.
export function proximasOcurrencias(fechas, hoy = new Date()) {
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return fechas
    .map((f) => {
      let ocurrencia = new Date(hoySinHora.getFullYear(), f.mes - 1, f.dia);
      if (ocurrencia < hoySinHora) ocurrencia = new Date(hoySinHora.getFullYear() + 1, f.mes - 1, f.dia);
      const diasFaltan = Math.round((ocurrencia - hoySinHora) / 86400000);
      return { ...f, fechaISO: ocurrencia.toISOString().slice(0, 10), diasFaltan };
    })
    .sort((a, b) => a.diasFaltan - b.diasFaltan);
}
