import { supabase } from "@/lib/supabaseClient";

export async function obtenerPacientesActivos() {
  const { data, error } = await supabase
    .from("pacientes")
    .select(
      `id, apellido_y_nombre, celular, dni, fecha_nacimiento, email, direccion, localidad,
       tipo_paciente, obra_social, numero_afiliado, profesional_responsable_id,
       estado_administrativo, estado_clinico,
       profesional_responsable:profesionales(nombre)`
    )
    .eq("estado", "Activo")
    .order("apellido_y_nombre")
    .limit(500);

  if (error) throw error;
  return data;
}

// Regla del doc 9: historial de turnos de un paciente, el más reciente primero.
export async function obtenerHistorialTurnosGeneral(pacienteId) {
  const { data, error } = await supabase
    .from("turnos_general")
    .select(
      `id, fecha, hora_inicio, tipo_atencion, cobertura, estado, confirmacion, asistencia,
       profesional_de_turno:profesionales!profesional_de_turno_id(nombre)`
    )
    .eq("paciente_id", pacienteId)
    .order("fecha", { ascending: false })
    .order("hora_inicio", { ascending: false })
    .limit(50);

  if (error) throw error;

  return data.map((fila) => ({
    id: fila.id,
    fecha: fila.fecha,
    horaInicio: fila.hora_inicio.slice(0, 5),
    tipoAtencion: fila.tipo_atencion,
    cobertura: fila.cobertura,
    estado: fila.estado,
    confirmacion: fila.confirmacion,
    asistencia: fila.asistencia,
    profesionalDeTurno: fila.profesional_de_turno?.nombre ?? "—",
  }));
}

export async function crearPaciente({ apellidoYNombre, celular, tipoPaciente, obraSocial }) {
  const { data, error } = await supabase
    .from("pacientes")
    .insert({
      apellido_y_nombre: apellidoYNombre,
      celular: celular || null,
      tipo_paciente: tipoPaciente,
      obra_social: obraSocial || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

const SELECT_PACIENTE = `id, apellido_y_nombre, dni, celular, fecha_nacimiento, tipo_paciente,
  obra_social, numero_afiliado, estado, email, direccion, localidad, como_nos_conocio,
  paciente_referido_por, estado_administrativo, estado_clinico, historia_clinica_completa,
  consentimientos_firmados, profesional_responsable_id,
  profesional_responsable:profesionales(nombre)`;

function mapearFilaPaciente(fila) {
  return {
    id: fila.id,
    apellidoYNombre: fila.apellido_y_nombre,
    dni: fila.dni,
    celular: fila.celular,
    fechaNacimiento: fila.fecha_nacimiento,
    tipoPaciente: fila.tipo_paciente,
    obraSocial: fila.obra_social,
    numeroAfiliado: fila.numero_afiliado,
    estado: fila.estado,
    email: fila.email,
    direccion: fila.direccion,
    localidad: fila.localidad,
    comoNosConocio: fila.como_nos_conocio,
    pacienteReferidoPor: fila.paciente_referido_por,
    estadoAdministrativo: fila.estado_administrativo,
    estadoClinico: fila.estado_clinico,
    historiaClinicaCompleta: fila.historia_clinica_completa,
    consentimientosFirmados: fila.consentimientos_firmados,
    profesionalResponsableId: fila.profesional_responsable_id,
    profesionalResponsable: fila.profesional_responsable?.nombre ?? null,
  };
}

export async function obtenerPacientes({ busqueda } = {}) {
  let query = supabase.from("pacientes").select(SELECT_PACIENTE).order("apellido_y_nombre");

  if (busqueda) {
    const texto = busqueda.trim();
    query = query.or(
      `apellido_y_nombre.ilike.%${texto}%,dni.ilike.%${texto}%,celular.ilike.%${texto}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapearFilaPaciente);
}

export async function obtenerPacientePorId(id) {
  const { data, error } = await supabase.from("pacientes").select(SELECT_PACIENTE).eq("id", id).single();
  if (error) throw error;
  return mapearFilaPaciente(data);
}

function datosPacienteDesdeFormulario(datos) {
  return {
    apellido_y_nombre: datos.apellidoYNombre,
    dni: datos.dni || null,
    celular: datos.celular || null,
    fecha_nacimiento: datos.fechaNacimiento || null,
    tipo_paciente: datos.tipoPaciente,
    obra_social: datos.tipoPaciente === "Particular" ? null : datos.obraSocial || null,
    numero_afiliado: datos.tipoPaciente === "Particular" ? null : datos.numeroAfiliado || null,
    estado: datos.estado,
    email: datos.email || null,
    direccion: datos.direccion || null,
    localidad: datos.localidad || null,
    como_nos_conocio: datos.comoNosConocio || null,
    paciente_referido_por: datos.pacienteReferidoPor || null,
    estado_administrativo: datos.estadoAdministrativo || null,
    estado_clinico: datos.estadoClinico || null,
    historia_clinica_completa: Boolean(datos.historiaClinicaCompleta),
    consentimientos_firmados: Boolean(datos.consentimientosFirmados),
    profesional_responsable_id: datos.profesionalResponsableId || null,
  };
}

export async function crearPacienteCompleto(datos) {
  const { data, error } = await supabase
    .from("pacientes")
    .insert(datosPacienteDesdeFormulario(datos))
    .select(SELECT_PACIENTE)
    .single();

  if (error) throw error;
  return mapearFilaPaciente(data);
}

export async function actualizarPaciente(id, datos) {
  const { data, error } = await supabase
    .from("pacientes")
    .update({ ...datosPacienteDesdeFormulario(datos), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(SELECT_PACIENTE)
    .single();

  if (error) throw error;
  return mapearFilaPaciente(data);
}

// Regla del doc 3.2: detectar y avisar sobre posibles duplicados (no bloquea la carga).
export async function buscarPosiblesDuplicados({ dni, celular, idExcluido }) {
  const condiciones = [];
  if (dni) condiciones.push(`dni.eq.${dni}`);
  if (celular) condiciones.push(`celular.eq.${celular}`);
  if (condiciones.length === 0) return [];

  let query = supabase
    .from("pacientes")
    .select("id, apellido_y_nombre, dni, celular")
    .or(condiciones.join(","));

  if (idExcluido) query = query.neq("id", idExcluido);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
