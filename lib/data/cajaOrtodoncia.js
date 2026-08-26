import { supabase } from "@/lib/supabaseClient";

const SELECT_COBRO = `id, fecha, concepto, cantidad_controles_abonados, bracket_reposicion, cantidad_brackets,
  importe, medio_pago, destino, observaciones,
  paciente:pacientes_ortodoncia(nombre),
  ortodoncista:profesionales!ortodoncista_id(nombre)`;

function mapearFila(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    concepto: f.concepto,
    cantidadControlesAbonados: f.cantidad_controles_abonados,
    bracketReposicion: f.bracket_reposicion,
    cantidadBrackets: f.cantidad_brackets,
    importe: f.importe,
    medioPago: f.medio_pago,
    destino: f.destino,
    observaciones: f.observaciones,
    paciente: f.paciente?.nombre ?? "—",
    ortodoncista: f.ortodoncista?.nombre ?? "—",
  };
}

export async function obtenerCobrosOrtodonciaPorFecha(fecha) {
  const { data, error } = await supabase
    .from("caja_ortodoncia")
    .select(SELECT_COBRO)
    .eq("fecha", fecha)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapearFila);
}

export async function crearCobroOrtodoncia(datos) {
  const { data, error } = await supabase
    .from("caja_ortodoncia")
    .insert({
      fecha: datos.fecha,
      paciente_id: datos.pacienteId,
      ortodoncista_id: datos.ortodoncistaId || null,
      concepto: datos.concepto,
      cantidad_controles_abonados: datos.cantidadControlesAbonados || null,
      bracket_reposicion: datos.bracketReposicion || null,
      cantidad_brackets: datos.cantidadBrackets || null,
      importe: datos.importe,
      medio_pago: datos.medioPago,
      destino: datos.medioPago === "Efectivo" ? "Caja" : "Banco",
      observaciones: datos.observaciones || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
