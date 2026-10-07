import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerPacientesOrtodoncia } from "@/lib/data/pacientesOrtodoncia";

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
export function calcularMesesAdeudados({ control, fechaInstalacion, anio, hoy, fechaInicioSeguimiento }) {
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

// Para el puntito rojo del menú — repite el mismo cálculo que la página de
// Cuentas por cobrar (año actual) y cuenta cuántos pacientes quedan con
// deuda mayor a cero.
export async function obtenerCantidadDeudoresOrtodoncia() {
  const anio = new Date().getFullYear();
  const hoy = new Date(fechaDeHoyISO() + "T12:00:00");

  const [pacientes, controles, fechaInicioDeuda] = await Promise.all([
    obtenerPacientesOrtodoncia(),
    obtenerControlesOrtodoncia(anio),
    obtenerFechaInicioDeudaOrtodoncia(),
  ]);

  return pacientes.filter((p) => {
    const { mesesAdeudados } = calcularMesesAdeudados({
      control: controles[p.id],
      fechaInstalacion: p.fechaInstalacion,
      anio,
      hoy,
      fechaInicioSeguimiento: fechaInicioDeuda,
    });
    return mesesAdeudados * Number(p.valorControl || 0) > 0;
  }).length;
}

// Al registrar el cobro de un Control, la grilla de Controles se completa
// sola. El primer control se marca en el mes del cobro ("vino en octubre");
// si abonó más, se marcan los meses adeudados del más viejo al más nuevo y,
// si todavía sobran, los meses que siguen como "Pagado Anticipado". Nunca
// pisa un mes ya marcado. Lo que se marcó queda guardado en el cobro para
// poder deshacerlo si ese cobro se borra.
export async function marcarControlesPagados({ pacienteId, cantidad, fechaInstalacion, fecha, cajaOrtodonciaId }) {
  const total = Math.max(1, Number(cantidad) || 1);
  const referencia = new Date((fecha || fechaDeHoyISO()) + "T12:00:00");
  const anio = referencia.getFullYear();
  const mesCobro = referencia.getMonth() + 1;

  const [fechaInicioSeguimiento, { data: filas, error }] = await Promise.all([
    obtenerFechaInicioDeudaOrtodoncia(),
    supabase.from("controles_ortodoncia").select(SELECT_CONTROL).eq("paciente_id", pacienteId).in("anio", [anio, anio + 1]),
  ]);
  if (error) throw error;
  const controlesPorAnio = {};
  (filas || []).forEach((f) => (controlesPorAnio[f.anio] = f));
  const estaMarcado = (a, clave) => {
    const estado = controlesPorAnio[a]?.[clave];
    return estado === "Pago" || estado === "Pagado Anticipado";
  };

  const marcas = [];
  const yaElegido = new Set();
  const elegir = (a, clave, valor) => {
    marcas.push({ anio: a, mesClave: clave, valor });
    yaElegido.add(`${a}-${clave}`);
  };
  let restantes = total;

  // 1) El mes en que vino a pagar.
  const claveCobro = MESES[mesCobro - 1].clave;
  if (!estaMarcado(anio, claveCobro)) {
    elegir(anio, claveCobro, "Pago");
    restantes--;
  }

  // 2) Meses adeudados, del más viejo al más nuevo.
  const { mesesVencidos } = calcularMesesAdeudados({
    control: controlesPorAnio[anio],
    fechaInstalacion,
    anio,
    hoy: referencia,
    fechaInicioSeguimiento,
  });
  for (const clave of mesesVencidos) {
    if (restantes <= 0) break;
    if (yaElegido.has(`${anio}-${clave}`)) continue;
    elegir(anio, clave, "Pago");
    restantes--;
  }

  // 3) Meses que siguen, como pagados por adelantado.
  let a = anio;
  let m = mesCobro;
  while (restantes > 0) {
    m++;
    if (m > 12) {
      m = 1;
      a++;
    }
    if (a > anio + 1) break;
    const clave = MESES[m - 1].clave;
    if (estaMarcado(a, clave) || yaElegido.has(`${a}-${clave}`)) continue;
    elegir(a, clave, "Pagado Anticipado");
    restantes--;
  }

  for (const marca of marcas) await actualizarMesControl(pacienteId, marca.anio, marca.mesClave, marca.valor);

  if (cajaOrtodonciaId && marcas.length > 0) {
    const { error: errorGuardar } = await supabase
      .from("caja_ortodoncia")
      .update({ controles_marcados: marcas })
      .eq("id", cajaOrtodonciaId);
    if (errorGuardar) console.error("No se pudo guardar qué meses marcó el cobro", errorGuardar);
  }
  return marcas;
}

// Deshace lo que marcó un cobro de Control: vacía cada mes que ese cobro
// había completado, siempre que siga con el mismo valor (si alguien lo
// cambió a mano después, no se toca).
export async function desmarcarControlesDeCobro(cajaOrtodonciaId) {
  const { data: cobro, error } = await supabase
    .from("caja_ortodoncia")
    .select("paciente_id, controles_marcados")
    .eq("id", cajaOrtodonciaId)
    .maybeSingle();
  if (error) throw error;
  const marcas = cobro?.controles_marcados;
  if (!cobro || !Array.isArray(marcas) || marcas.length === 0) return [];

  const desmarcadas = [];
  for (const marca of marcas) {
    const { data: fila, error: errorFila } = await supabase
      .from("controles_ortodoncia")
      .select(SELECT_CONTROL)
      .eq("paciente_id", cobro.paciente_id)
      .eq("anio", marca.anio)
      .maybeSingle();
    if (errorFila) throw errorFila;
    if (fila?.[marca.mesClave] !== marca.valor) continue;
    await actualizarMesControl(cobro.paciente_id, marca.anio, marca.mesClave, "");
    desmarcadas.push(marca);
  }
  return desmarcadas;
}
