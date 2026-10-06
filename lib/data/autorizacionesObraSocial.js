import { supabase } from "@/lib/supabaseClient";

export const ESTADOS_AUTORIZACION = ["Para autorizar", "Enviada", "Autorizada"];

export function normalizar(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

// Los nombres de obra social de los pacientes no siempre coinciden letra
// por letra con los del nomenclador ("Sancor" vs "Sancor Salud", mayúsculas,
// tildes). Busca primero una coincidencia exacta y, si no, una única que
// contenga o esté contenida; si hay dudas (varias), no adivina.
export function obraDelNomenclador(texto, obrasNomenclador) {
  const buscada = normalizar(texto);
  if (!buscada) return null;
  const exacta = obrasNomenclador.find((o) => normalizar(o) === buscada);
  if (exacta) return exacta;
  const parecidas = obrasNomenclador.filter((o) => {
    const n = normalizar(o);
    return n.includes(buscada) || buscada.includes(n);
  });
  return parecidas.length === 1 ? parecidas[0] : null;
}

// Lista de obras sociales que tienen prestaciones cargadas en el
// nomenclador. Se pide por páginas porque la base devuelve un máximo de
// 1000 filas por consulta.
export async function obtenerObrasSocialesDelNomenclador() {
  const nombres = new Set();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("nomenclador")
      .select("obra_social")
      .or("estado.is.null,estado.neq.Suspendido")
      .range(desde, desde + 999);
    if (error) throw error;
    data.forEach((f) => f.obra_social && nombres.add(f.obra_social));
    if (data.length < 1000) break;
  }
  return [...nombres].sort((a, b) => a.localeCompare(b, "es"));
}

export async function obtenerPrestacionesDeObra(obraSocial) {
  const { data, error } = await supabase
    .from("nomenclador")
    .select("id, codigo, prestacion_os")
    .eq("obra_social", obraSocial)
    .or("estado.is.null,estado.neq.Suspendido")
    .not("prestacion_os", "is", null)
    .order("prestacion_os");
  if (error) throw error;
  return data;
}

// Pacientes que en la agenda tienen un turno con obra social aunque en su
// ficha figuren como particulares. Devuelve, por paciente, la cobertura de
// su turno más reciente (de los últimos 90 días en adelante).
export async function obtenerCoberturasDeAgenda() {
  const desde = new Date();
  desde.setDate(desde.getDate() - 90);
  const desdeISO = `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, "0")}-${String(desde.getDate()).padStart(2, "0")}`;
  const porPaciente = {};
  for (let d = 0; ; d += 1000) {
    const { data, error } = await supabase
      .from("turnos_general")
      .select("paciente_id, fecha, cobertura, numero_afiliado")
      .gte("fecha", desdeISO)
      .not("paciente_id", "is", null)
      .not("cobertura", "is", null)
      .order("fecha", { ascending: false })
      .range(d, d + 999);
    if (error) throw error;
    for (const t of data) {
      if (normalizar(t.cobertura) === "particular") continue;
      if (!porPaciente[t.paciente_id]) {
        porPaciente[t.paciente_id] = { obraSocial: t.cobertura.trim(), numeroAfiliado: t.numero_afiliado };
      }
    }
    if (data.length < 1000) break;
  }
  return porPaciente;
}

function mapearFila(f) {
  return {
    id: f.id,
    pacienteId: f.paciente_id,
    pacienteNombre: f.paciente?.apellido_y_nombre || "(paciente borrado)",
    obraSocial: f.obra_social,
    numeroAfiliado: f.numero_afiliado,
    prestacion: f.prestacion,
    estado: f.estado,
    fechaPedido: f.fecha_pedido,
    fechaEnvio: f.fecha_envio,
    fechaAutorizacion: f.fecha_autorizacion,
    numeroAutorizacion: f.numero_autorizacion,
    observaciones: f.observaciones,
  };
}

const SELECT = "*, paciente:pacientes(apellido_y_nombre)";

export async function obtenerAutorizaciones() {
  const { data, error } = await supabase
    .from("autorizaciones_obra_social")
    .select(SELECT)
    .order("fecha_pedido", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapearFila);
}

export async function obtenerCantidadParaAutorizar() {
  const { count, error } = await supabase
    .from("autorizaciones_obra_social")
    .select("id", { count: "exact", head: true })
    .eq("estado", "Para autorizar");
  if (error) throw error;
  return count || 0;
}

function aFila(datos) {
  return {
    paciente_id: datos.pacienteId,
    obra_social: datos.obraSocial.trim(),
    numero_afiliado: datos.numeroAfiliado?.trim() || null,
    prestacion: datos.prestacion.trim(),
    estado: datos.estado,
    fecha_pedido: datos.fechaPedido,
    fecha_envio: datos.estado === "Para autorizar" ? null : datos.fechaEnvio || null,
    fecha_autorizacion: datos.estado === "Autorizada" ? datos.fechaAutorizacion || null : null,
    numero_autorizacion: datos.numeroAutorizacion?.trim() || null,
    observaciones: datos.observaciones?.trim() || null,
  };
}

export async function crearAutorizacion(datos) {
  const { error } = await supabase.from("autorizaciones_obra_social").insert(aFila(datos));
  if (error) throw error;
}

export async function actualizarAutorizacion(id, datos) {
  const { error } = await supabase
    .from("autorizaciones_obra_social")
    .update({ ...aFila(datos), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function eliminarAutorizacion(id) {
  const { error } = await supabase.from("autorizaciones_obra_social").delete().eq("id", id);
  if (error) throw error;
}
