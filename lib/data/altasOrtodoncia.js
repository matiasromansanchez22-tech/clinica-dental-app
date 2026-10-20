import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { calcularProximoAumento } from "@/lib/ortodoncia";
import { nombreCercano } from "@/lib/whatsapp";

// Pacientes de Ortodoncia dados de alta y seguimiento cada 6 meses.
// "De alta" = estado "Finalizado" + fecha de alta. Cada MESES_ENTRE_SEGUIMIENTOS meses (desde el
// alta o desde el último mensaje) hay que escribirles para ver cómo viene todo.

export const MESES_ENTRE_SEGUIMIENTOS = 6;

// Marca al paciente de alta: queda Finalizado (sale de Controles, Aumentos y de los activos).
export async function marcarAltaPaciente(pacienteId, fechaAlta = fechaDeHoyISO()) {
  const { error } = await supabase
    .from("pacientes_ortodoncia")
    .update({
      estado_paciente: "Finalizado",
      fecha_alta: fechaAlta,
      ultimo_seguimiento_alta: null,
      nota_alta: null,
    })
    .eq("id", pacienteId);
  if (error) throw error;
}

// Cuando el ortodoncista indica el alta en la visita. Si todavía no se corrió la migración 159
// no frena nada: lo que importa (la visita) ya quedó guardado.
export async function marcarAltaDesdeVisita(pacienteId, fechaAlta) {
  try {
    await marcarAltaPaciente(pacienteId, fechaAlta);
  } catch (e) {
    console.error("No se pudo marcar el alta en la ficha", e);
  }
}

// Vuelve a tratamiento (por ejemplo, retomó).
export async function reactivarPaciente(pacienteId) {
  const { error } = await supabase
    .from("pacientes_ortodoncia")
    .update({ estado_paciente: "Activo", fecha_alta: null, ultimo_seguimiento_alta: null, nota_alta: null })
    .eq("id", pacienteId);
  if (error) throw error;
}

export async function corregirFechaAlta(pacienteId, fechaAlta) {
  const { error } = await supabase.from("pacientes_ortodoncia").update({ fecha_alta: fechaAlta }).eq("id", pacienteId);
  if (error) throw error;
}

// Se le escribió hoy: el próximo aviso es dentro de 6 meses.
export async function registrarSeguimientoAlta(pacienteId, nota) {
  const { error } = await supabase
    .from("pacientes_ortodoncia")
    .update({ ultimo_seguimiento_alta: fechaDeHoyISO(), nota_alta: nota?.trim() || null })
    .eq("id", pacienteId);
  if (error) throw error;
}

// Cuándo toca el próximo mensaje (null si no hay fecha de alta ni de seguimiento).
export function proximoSeguimientoAlta(p) {
  const base = p.ultimoSeguimiento || p.fechaAlta;
  return base ? calcularProximoAumento(base, MESES_ENTRE_SEGUIMIENTOS) : null;
}

export async function obtenerAltas() {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("pacientes_ortodoncia")
      .select(
        "id, nombre, whatsapp, estado_paciente, ortodoncista_id, fecha_alta, ultimo_seguimiento_alta, nota_alta, ortodoncista:profesionales!ortodoncista_id(nombre)"
      )
      .or("fecha_alta.not.is.null,estado_paciente.eq.Finalizado")
      .range(desde, desde + 999);
    if (error) return { disponible: false, altas: [] };
    filas.push(...data);
    if (data.length < 1000) break;
  }
  const hoy = fechaDeHoyISO();
  const altas = filas
    .map((f) => {
      const p = {
        id: f.id,
        nombre: f.nombre,
        whatsapp: f.whatsapp,
        ortodoncista: f.ortodoncista?.nombre ?? "Sin asignar",
        fechaAlta: f.fecha_alta,
        ultimoSeguimiento: f.ultimo_seguimiento_alta,
        nota: f.nota_alta,
      };
      const proximo = proximoSeguimientoAlta(p);
      return { ...p, proximoSeguimiento: proximo, paraEscribir: Boolean(proximo) && proximo <= hoy };
    })
    .sort((a, b) => (a.proximoSeguimiento || "9999").localeCompare(b.proximoSeguimiento || "9999") || a.nombre.localeCompare(b.nombre, "es"));
  return { disponible: true, altas };
}

export async function obtenerCantidadAltasParaEscribir() {
  const { altas } = await obtenerAltas();
  return altas.filter((a) => a.paraEscribir).length;
}

// Pacientes en tratamiento, para elegir a quién dar de alta.
export async function obtenerPacientesParaAlta() {
  const { data, error } = await supabase
    .from("pacientes_ortodoncia")
    .select("id, nombre")
    .eq("estado_paciente", "Activo")
    .order("nombre")
    .limit(1000);
  if (error) throw error;
  return data;
}

export function mensajeSeguimientoAlta(nombrePaciente) {
  const nombre = nombreCercano(nombrePaciente);
  return `¡Hola ${nombre}! Te escribimos desde Clínica Dental Marianela Ramírez. Pasó un tiempo desde que terminaste tu tratamiento de ortodoncia y queríamos saber cómo venís con todo: ¿usás el retenedor?, ¿notás algún cambio en tus dientes? Si querés, coordinamos un control. ¡Un abrazo!`;
}
