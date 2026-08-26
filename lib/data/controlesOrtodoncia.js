import { supabase } from "@/lib/supabaseClient";

export const MESES = [
  { clave: "ene", numero: 1, etiqueta: "Ene" },
  { clave: "feb", numero: 2, etiqueta: "Feb" },
  { clave: "mar", numero: 3, etiqueta: "Mar" },
  { clave: "abr", numero: 4, etiqueta: "Abr" },
  { clave: "may", numero: 5, etiqueta: "May" },
  { clave: "jun", numero: 6, etiqueta: "Jun" },
  { clave: "jul", numero: 7, etiqueta: "Jul" },
  { clave: "ago", numero: 8, etiqueta: "Ago" },
  { clave: "sep", numero: 9, etiqueta: "Sep" },
  { clave: "oct", numero: 10, etiqueta: "Oct" },
  { clave: "nov", numero: 11, etiqueta: "Nov" },
  { clave: "dic", numero: 12, etiqueta: "Dic" },
];

const SELECT_CONTROL =
  "id, paciente_id, anio, ene, feb, mar, abr, may, jun, jul, ago, sep, oct, nov, dic, observaciones, estado_gestion, detalle_gestion, fecha_ultimo_contacto";

export const ESTADOS_GESTION = [
  "Sin gestionar",
  "Contactado - sin respuesta",
  "Contactado - acordó pago",
  "Pagó",
  "No va a pagar",
];

export async function obtenerFechaInicioDeudaOrtodoncia() {
  const { data, error } = await supabase.from("configuracion_deuda_ortodoncia").select("fecha_inicio").eq("id", 1).single();
  if (error) throw error;
  return data.fecha_inicio;
}

export async function actualizarFechaInicioDeudaOrtodoncia(fechaInicio) {
  const { error } = await supabase
    .from("configuracion_deuda_ortodoncia")
    .update({ fecha_inicio: fechaInicio })
    .eq("id", 1);
  if (error) throw error;
}

export async function obtenerControlesOrtodoncia(anio) {
  const { data, error } = await supabase.from("controles_ortodoncia").select(SELECT_CONTROL).eq("anio", anio);
  if (error) throw error;
  const porPaciente = {};
  data.forEach((fila) => (porPaciente[fila.paciente_id] = fila));
  return porPaciente;
}

export async function actualizarMesControl(pacienteId, anio, mesClave, valor) {
  const { data, error } = await supabase
    .from("controles_ortodoncia")
    .upsert(
      { paciente_id: pacienteId, anio, [mesClave]: valor || null, updated_at: new Date().toISOString() },
      { onConflict: "paciente_id,anio" }
    )
    .select(SELECT_CONTROL)
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarObservacionesControl(pacienteId, anio, observaciones) {
  const { data, error } = await supabase
    .from("controles_ortodoncia")
    .upsert(
      { paciente_id: pacienteId, anio, observaciones: observaciones || null, updated_at: new Date().toISOString() },
      { onConflict: "paciente_id,anio" }
    )
    .select(SELECT_CONTROL)
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarGestionControl(pacienteId, anio, cambios) {
  const { data, error } = await supabase
    .from("controles_ortodoncia")
    .upsert(
      { paciente_id: pacienteId, anio, ...cambios, updated_at: new Date().toISOString() },
      { onConflict: "paciente_id,anio" }
    )
    .select(SELECT_CONTROL)
    .single();
  if (error) throw error;
  return data;
}

// Cuenta desde el mes de instalación (o Enero si fue antes de este año) hasta
// el mes actual (o Diciembre si es un año ya cerrado), los meses sin marcar
// Pago/Pagado Anticipado.
export function calcularMesesAdeudados({ control, fechaInstalacion, valorControl, anio, hoy, fechaInicioSeguimiento }) {
  // Sin una cuota de control cargada, el paciente todavía no está en el
  // circuito de pago de controles (recién agendado, sin instalar aún).
  if (!valorControl) return { mesesAdeudados: 0, mesesVencidos: [] };

  const anioActual = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1;

  // La fecha de instalación, cuando está cargada, afina desde qué mes
  // exacto empieza a deber (por ejemplo si se instaló a mitad de año).
  // Muchos pacientes migrados de la planilla vieja no la tienen cargada
  // pero ya están instalados hace tiempo — en ese caso no los excluimos,
  // solo no ajustamos el mes de inicio por instalación.
  let mesInicio = 1;
  if (fechaInstalacion) {
    const [anioInst, mesInst] = fechaInstalacion.split("-").map(Number);
    if (anioInst === anio) mesInicio = mesInst;
    if (anioInst > anio) return { mesesAdeudados: 0, mesesVencidos: [] };
  }

  // Todo lo anterior a la fecha de corte (configurable) no cuenta como deuda:
  // la planilla vieja nunca trackeó esto de forma confiable.
  if (fechaInicioSeguimiento) {
    const [anioCorte, mesCorte] = fechaInicioSeguimiento.split("-").map(Number);
    if (anioCorte > anio) return { mesesAdeudados: 0, mesesVencidos: [] };
    if (anioCorte === anio) mesInicio = Math.max(mesInicio, mesCorte);
  }

  let mesFin;
  if (anio < anioActual) mesFin = 12;
  else if (anio === anioActual) mesFin = mesActual;
  else return { mesesAdeudados: 0, mesesVencidos: [] };

  const mesesVencidos = [];
  for (const m of MESES) {
    if (m.numero < mesInicio || m.numero > mesFin) continue;
    const estado = control?.[m.clave];
    if (estado !== "Pago" && estado !== "Pagado Anticipado") mesesVencidos.push(m.clave);
  }
  return { mesesAdeudados: mesesVencidos.length, mesesVencidos };
}
