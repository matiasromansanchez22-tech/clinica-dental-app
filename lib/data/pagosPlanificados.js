import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { crearGastoConReserva } from "@/lib/data/gastos";
import { buscarPosiblesDuplicados } from "@/lib/data/posiblesDuplicados";
import { obtenerGastosRecurrentes, obtenerPagosDelMesPorNombre } from "@/lib/data/gastosRecurrentes";

function mapear(f) {
  return {
    id: f.id,
    concepto: f.concepto,
    categoria: f.categoria,
    monto: Number(f.monto),
    medioPago: f.medio_pago,
    fecha: f.fecha,
    desdeReserva: f.desde_reserva,
    recordar: Boolean(f.recordar),
    notas: f.notas,
    creadoEn: f.created_at,
  };
}

export async function obtenerPagosPlanificados() {
  const { data, error } = await supabase.from("pagos_planificados").select("*").order("created_at");
  if (error) throw error;
  return data.map(mapear);
}

export async function crearPagoPlanificado({ concepto, categoria, monto, medioPago, fecha, desdeReserva, notas, recordar }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("pagos_planificados")
    .insert({
      concepto: concepto.trim(),
      categoria,
      monto: Number(monto),
      medio_pago: medioPago || "Transferencia",
      fecha: fecha || null,
      desde_reserva: desdeReserva !== false,
      recordar: Boolean(recordar),
      notas: notas?.trim() || null,
      created_by: user?.id || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapear(data);
}

export async function actualizarPagoPlanificado(id, cambios) {
  const fila = {};
  if (cambios.monto !== undefined) fila.monto = Number(cambios.monto);
  if (cambios.medioPago !== undefined) fila.medio_pago = cambios.medioPago;
  if (cambios.desdeReserva !== undefined) fila.desde_reserva = cambios.desdeReserva;
  if (cambios.categoria !== undefined) fila.categoria = cambios.categoria;
  if (cambios.fecha !== undefined) fila.fecha = cambios.fecha || null;
  const { error } = await supabase.from("pagos_planificados").update(fila).eq("id", id);
  if (error) throw error;
}

export async function eliminarPagoPlanificado(id) {
  const { error } = await supabase.from("pagos_planificados").delete().eq("id", id);
  if (error) throw error;
}

// Trae a la lista los gastos fijos de "Gastos de la Clínica" (alquiler, luz, internet...) que todavía no se pagaron este mes y
// que no están ya en la lista. Los que no tienen monto sugerido se devuelven aparte para cargarlos a mano.
export async function traerGastosFijosDelMes(planificados, categorias) {
  const hoy = fechaDeHoyISO();
  const inicioMes = `${hoy.slice(0, 8)}01`;
  const [recurrentes, pagadosPorNombre] = await Promise.all([obtenerGastosRecurrentes(), obtenerPagosDelMesPorNombre(inicioMes, hoy)]);
  const enLista = new Set(planificados.map((p) => p.concepto.trim().toLowerCase()));
  const agregados = [];
  const sinMonto = [];
  for (const r of recurrentes) {
    if ((pagadosPorNombre[r.nombre] || []).length > 0) continue; // ya se pagó este mes
    if (enLista.has(r.nombre.trim().toLowerCase())) continue;
    if (!r.montoSugerido || r.montoSugerido <= 0) {
      sinMonto.push(r.nombre);
      continue;
    }
    const categoria = categorias.some((c) => c.nombre === r.categoria) ? r.categoria : "Otro";
    agregados.push(await crearPagoPlanificado({ concepto: r.nombre, categoria, monto: r.montoSugerido, medioPago: "Transferencia", desdeReserva: true }));
  }
  return { agregados, sinMonto };
}

// Posibles duplicados contra lo ya cargado en Gastos y repetidos dentro de la propia lista.
export async function revisarDuplicados(items) {
  const avisos = [];
  const vistos = new Map();
  for (const it of items) {
    const clave = `${it.concepto.trim().toLowerCase()}|${it.monto}`;
    if (vistos.has(clave)) avisos.push(`"${it.concepto}" por $${Math.round(it.monto).toLocaleString("es-AR")} está dos veces en la lista.`);
    vistos.set(clave, true);
    try {
      const parecidos = await buscarPosiblesDuplicados({ tabla: "gastos", fecha: it.fecha || fechaDeHoyISO(), monto: it.monto, quien: it.concepto });
      if (parecidos.length > 0) avisos.push(`"${it.concepto}" ($${Math.round(it.monto).toLocaleString("es-AR")}) se parece a un gasto ya cargado.`);
    } catch {
      // si no se puede revisar, no frena nada
    }
  }
  return avisos;
}

const normal = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Deja anotado el monto que se pagó para que el mes que viene salga solo: si el concepto ya es un gasto fijo de
// "Gastos de la Clínica" (alquiler, internet...), le actualiza el monto; si no, y se pidió recordarlo, lo crea como gasto fijo.
// Nunca frena el registro del gasto.
async function recordarMonto(item) {
  try {
    const { data: fijos } = await supabase.from("gastos_recurrentes").select("id, nombre").eq("activo", true);
    const igual = (fijos || []).find((f) => normal(f.nombre) === normal(item.concepto));
    if (igual) {
      await supabase.from("gastos_recurrentes").update({ monto_sugerido: item.monto, updated_at: new Date().toISOString() }).eq("id", igual.id);
    } else if (item.recordar) {
      await supabase.from("gastos_recurrentes").insert({ nombre: item.concepto, categoria: item.categoria, tipo: "Fijo", monto_sugerido: item.monto });
    }
  } catch {
    // no pasa nada: el gasto ya está registrado
  }
}

// Registra todos los pagos de la lista como gastos (con descuento de la reserva si corresponde) y los saca de la lista.
// Si alguno falla, queda en la lista y se devuelve con su error; los demás se registran igual.
export async function registrarPagosPlanificados(items, categorias) {
  const hoy = fechaDeHoyISO();
  const registrados = [];
  const fallidos = [];
  for (const it of items) {
    try {
      await crearGastoConReserva(
        {
          fecha: it.fecha || hoy,
          categoria: it.categoria,
          descripcion: it.concepto,
          monto: it.monto,
          medioPago: it.medioPago,
          observaciones: it.notas || undefined,
          desdeReserva: it.desdeReserva,
        },
        categorias
      );
      registrados.push(it);
    } catch (e) {
      fallidos.push({ item: it, error: e.message });
      continue;
    }
    // El gasto ya quedó registrado: se saca de la lista (si esto fallara, no se vuelve a registrar solo).
    await recordarMonto(it);
    await eliminarPagoPlanificado(it.id).catch(() => {});
  }
  return { registrados, fallidos };
}
