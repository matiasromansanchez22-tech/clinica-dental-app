import { supabase } from "@/lib/supabaseClient";
import { calcularProximoAumento } from "@/lib/ortodoncia";

const SELECT_PACIENTE = `id, codigo_legado, nombre, whatsapp, fecha_nacimiento, fecha_instalacion,
  historial_clinico, fotografias, rx_inicial, rx_6_meses, rx_12_meses, consentimiento,
  tipo_brackets, cuota_inicial, forma_pago_instalacion, instalacion_cuota_1, instalacion_cuota_2,
  estado_instalacion, valor_control, ortodoncista_id, estado_paciente, ultimo_control,
  proximo_turno, observaciones_clinicas, ultimo_aumento, proximo_aumento, referido_por,
  email, fecha_baja, origen_paciente, clinica_procedencia,
  ortodoncista:profesionales(nombre)`;

function mapearFila(f) {
  return {
    id: f.id,
    codigoLegado: f.codigo_legado,
    nombre: f.nombre,
    whatsapp: f.whatsapp,
    fechaNacimiento: f.fecha_nacimiento,
    fechaInstalacion: f.fecha_instalacion,
    historialClinico: f.historial_clinico,
    fotografias: f.fotografias,
    rxInicial: f.rx_inicial,
    rx6Meses: f.rx_6_meses,
    rx12Meses: f.rx_12_meses,
    consentimiento: f.consentimiento,
    tipoBrackets: f.tipo_brackets,
    cuotaInicial: f.cuota_inicial,
    formaPagoInstalacion: f.forma_pago_instalacion,
    instalacionCuota1: f.instalacion_cuota_1,
    instalacionCuota2: f.instalacion_cuota_2,
    estadoInstalacion: f.estado_instalacion,
    valorControl: f.valor_control,
    ortodoncistaId: f.ortodoncista_id,
    ortodoncista: f.ortodoncista?.nombre ?? "—",
    estadoPaciente: f.estado_paciente,
    ultimoControl: f.ultimo_control,
    proximoTurno: f.proximo_turno,
    observacionesClinicas: f.observaciones_clinicas,
    ultimoAumento: f.ultimo_aumento,
    proximoAumento: f.proximo_aumento,
    referidoPor: f.referido_por,
    email: f.email,
    fechaBaja: f.fecha_baja,
    origenPaciente: f.origen_paciente,
    clinicaProcedencia: f.clinica_procedencia,
  };
}

export async function obtenerPacientesOrtodoncia({ busqueda } = {}) {
  let query = supabase.from("pacientes_ortodoncia").select(SELECT_PACIENTE).order("nombre");
  if (busqueda) {
    query = query.or(`nombre.ilike.%${busqueda}%,whatsapp.ilike.%${busqueda}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapearFila);
}

export async function obtenerPacienteOrtodonciaPorId(id) {
  const { data, error } = await supabase.from("pacientes_ortodoncia").select(SELECT_PACIENTE).eq("id", id).single();
  if (error) throw error;
  return mapearFila(data);
}

function datosDesdeFormulario(datos) {
  return {
    nombre: datos.nombre,
    whatsapp: datos.whatsapp || null,
    fecha_nacimiento: datos.fechaNacimiento || null,
    fecha_instalacion: datos.fechaInstalacion || null,
    historial_clinico: datos.historialClinico || null,
    fotografias: datos.fotografias || null,
    rx_inicial: datos.rxInicial || null,
    rx_6_meses: datos.rx6Meses || null,
    rx_12_meses: datos.rx12Meses || null,
    consentimiento: datos.consentimiento || null,
    tipo_brackets: datos.tipoBrackets || null,
    cuota_inicial: datos.cuotaInicial || null,
    forma_pago_instalacion: datos.formaPagoInstalacion || null,
    estado_instalacion: datos.estadoInstalacion || null,
    valor_control: datos.valorControl || null,
    ortodoncista_id: datos.ortodoncistaId || null,
    estado_paciente: datos.estadoPaciente || "Activo",
    ultimo_control: datos.ultimoControl || null,
    proximo_turno: datos.proximoTurno || null,
    observaciones_clinicas: datos.observacionesClinicas || null,
    ultimo_aumento: datos.ultimoAumento || null,
    proximo_aumento: datos.ultimoAumento
      ? calcularProximoAumento(datos.ultimoAumento, datos.mesesEntreAumentos || 6)
      : datos.proximoAumento || null,
    referido_por: datos.referidoPor || null,
    email: datos.email || null,
    origen_paciente: datos.origenPaciente || null,
    clinica_procedencia: datos.origenPaciente === "Continuación de otra clínica" ? datos.clinicaProcedencia || null : null,
  };
}

export async function crearPacienteOrtodoncia(datos) {
  const { data, error } = await supabase
    .from("pacientes_ortodoncia")
    .insert(datosDesdeFormulario(datos))
    .select(SELECT_PACIENTE)
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function actualizarPacienteOrtodoncia(id, datos) {
  const { data, error } = await supabase
    .from("pacientes_ortodoncia")
    .update({ ...datosDesdeFormulario(datos), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(SELECT_PACIENTE)
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function aplicarAumentoCuota(id, nuevoValorControl, fechaAumento, mesesEntreAumentos) {
  const { data, error } = await supabase
    .from("pacientes_ortodoncia")
    .update({
      valor_control: nuevoValorControl,
      ultimo_aumento: fechaAumento,
      proximo_aumento: calcularProximoAumento(fechaAumento, mesesEntreAumentos),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(SELECT_PACIENTE)
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function obtenerConfiguracionOrtodoncia() {
  const { data, error } = await supabase.from("configuracion_ortodoncia").select("*");
  if (error) throw error;
  const mapa = {};
  data.forEach((f) => (mapa[f.clave] = Number(f.valor)));
  return mapa;
}
