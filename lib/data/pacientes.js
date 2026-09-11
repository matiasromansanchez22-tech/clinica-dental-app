import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";

// Para el desplegable de sugerencias al cargar la obra social de un
// paciente — junta las que ya están cargadas para que se puedan elegir en
// vez de tipearlas de nuevo y arriesgarse a un error de tipeo. Si
// aparece una obra social nueva que todavía no está en la lista, se
// puede seguir escribiendo libremente. Agrupa sin importar mayúsculas
// (para no sugerir "OSDE" y "Osde" como si fueran dos distintas) y de
// cada grupo se queda con la forma que más se usó, para sugerir siempre
// la misma.
export async function obtenerObrasSocialesSugeridas() {
  const { data, error } = await supabase.from("pacientes").select("obra_social").not("obra_social", "is", null);
  if (error) throw error;

  const grupos = new Map();
  data.forEach((f) => {
    const valor = f.obra_social?.trim();
    if (!valor) return;
    const clave = valor.toLowerCase();
    if (!grupos.has(clave)) grupos.set(clave, new Map());
    const variantes = grupos.get(clave);
    variantes.set(valor, (variantes.get(valor) || 0) + 1);
  });

  const masUsadaPorGrupo = [...grupos.values()].map(
    (variantes) => [...variantes.entries()].sort((a, b) => b[1] - a[1])[0][0]
  );
  return masUsadaPorGrupo.sort((a, b) => a.localeCompare(b, "es"));
}

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

export const RELACIONES_FAMILIARES = ["Madre", "Padre", "Hijo/a", "Hermano/a", "Pareja", "Otro"];

// Al mostrar el vínculo desde el otro lado (el paciente que NO lo cargó),
// hay que dar vuelta la relación: si Juana es la "Madre" de Ana, desde la
// ficha de Juana, Ana aparece como su "Hijo/a".
const INVERSO_RELACION = {
  Madre: "Hijo/a",
  Padre: "Hijo/a",
  "Hijo/a": "Padre/Madre",
  "Hermano/a": "Hermano/a",
  Pareja: "Pareja",
  Otro: "Otro",
};

// Trae los familiares vinculados de un paciente, mirando el vínculo desde
// los dos lados (da igual quién lo haya cargado primero), cada uno con la
// relación ya acomodada para verse correcta desde este paciente.
export async function obtenerFamiliaresDePaciente(pacienteId) {
  const [{ data: comoOrigen, error: e1 }, { data: comoDestino, error: e2 }] = await Promise.all([
    supabase
      .from("vinculos_familiares")
      .select("id, relacion, paciente_vinculado:pacientes!paciente_vinculado_id(id, apellido_y_nombre, celular)")
      .eq("paciente_id", pacienteId),
    supabase
      .from("vinculos_familiares")
      .select("id, relacion, paciente:pacientes!paciente_id(id, apellido_y_nombre, celular)")
      .eq("paciente_vinculado_id", pacienteId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const desdeOrigen = (comoOrigen || []).map((f) => ({
    vinculoId: f.id,
    pacienteId: f.paciente_vinculado.id,
    nombre: f.paciente_vinculado.apellido_y_nombre,
    celular: f.paciente_vinculado.celular,
    relacion: f.relacion,
  }));
  const desdeDestino = (comoDestino || []).map((f) => ({
    vinculoId: f.id,
    pacienteId: f.paciente.id,
    nombre: f.paciente.apellido_y_nombre,
    celular: f.paciente.celular,
    relacion: INVERSO_RELACION[f.relacion] || f.relacion,
  }));

  return [...desdeOrigen, ...desdeDestino].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function crearVinculoFamiliar(pacienteId, pacienteVinculadoId, relacion) {
  const { error } = await supabase
    .from("vinculos_familiares")
    .insert({ paciente_id: pacienteId, paciente_vinculado_id: pacienteVinculadoId, relacion });
  if (error) throw error;
}

export async function eliminarVinculoFamiliar(vinculoId) {
  const { error } = await supabase.from("vinculos_familiares").delete().eq("id", vinculoId);
  if (error) throw error;
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

// Solo el tilde de "autoriza fotos en redes" — aparte del select grande
// de arriba, así no se rompe nada si todavía no se corrió la migración
// que agrega esta columna (esta función sola devuelve vacío en ese caso).
export async function obtenerAutorizacionesFotos() {
  try {
    const { data, error } = await supabase.from("pacientes").select("id, autoriza_fotos_redes");
    if (error) throw error;
    return Object.fromEntries(data.map((f) => [f.id, f.autoriza_fotos_redes]));
  } catch {
    return {};
  }
}

export async function actualizarAutorizacionFotos(id, autoriza) {
  const { error } = await supabase.from("pacientes").update({ autoriza_fotos_redes: autoriza }).eq("id", id);
  if (error) throw error;
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

// Para el Panel de Estadísticas: guarda CUÁNDO se marcó completa la historia
// clínica / el consentimiento (solo la primera vez que pasa a true), así se
// puede contar "cuántos se completaron hoy" y no solo el total acumulado.
async function camposMarcadoEn(id, nuevaHistoriaClinicaCompleta, nuevoConsentimientoFirmado) {
  const { data, error } = await supabase
    .from("pacientes")
    .select("historia_clinica_completa, consentimientos_firmados")
    .eq("id", id)
    .single();
  if (error) throw error;

  const cambios = {};
  if (nuevaHistoriaClinicaCompleta && !data.historia_clinica_completa) {
    cambios.historia_clinica_marcada_en = new Date().toISOString();
  }
  if (nuevoConsentimientoFirmado && !data.consentimientos_firmados) {
    cambios.consentimiento_marcado_en = new Date().toISOString();
  }
  return cambios;
}

// Update chico para tildar rápido desde la lista, sin tener que abrir la
// ficha completa del paciente.
export async function actualizarBanderasPaciente(id, { historiaClinicaCompleta, consentimientosFirmados }) {
  const marcados = await camposMarcadoEn(id, historiaClinicaCompleta, consentimientosFirmados);
  const { error } = await supabase
    .from("pacientes")
    .update({
      historia_clinica_completa: historiaClinicaCompleta,
      consentimientos_firmados: consentimientosFirmados,
      ...marcados,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function actualizarPaciente(id, datos) {
  const marcados = await camposMarcadoEn(id, Boolean(datos.historiaClinicaCompleta), Boolean(datos.consentimientosFirmados));
  const { data, error } = await supabase
    .from("pacientes")
    .update({ ...datosPacienteDesdeFormulario(datos), ...marcados, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(SELECT_PACIENTE)
    .single();

  if (error) throw error;
  return mapearFilaPaciente(data);
}

// Solo se puede borrar si el paciente no tiene turnos, cobros ni
// presupuestos cargados (la base lo protege sola con esa restricción) —
// para eso está, así no se pierde el historial de un paciente real por
// error. Sirve para sacar altas duplicadas o cargadas por equivocación.
export async function eliminarPaciente(id) {
  try {
    await moverAPapelera("pacientes", id);
  } catch (e) {
    if (e.code === "23503") {
      throw new Error(
        "No se puede borrar: este paciente ya tiene turnos, cobros o presupuestos cargados. Si fue un error de carga, marcalo como Inactivo en vez de borrarlo."
      );
    }
    throw e;
  }
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
