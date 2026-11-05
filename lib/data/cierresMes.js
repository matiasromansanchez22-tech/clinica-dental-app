import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";
import { obtenerCierresDelMes } from "@/lib/data/cierresDia";
import { crearMovimientoPersonal, eliminarMovimientoPersonal } from "@/lib/data/finanzasPersonales";
import { esMesDePrueba } from "@/lib/mesesDePrueba";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function rangoDelMes(anio, mes) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const fin = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { inicio, fin };
}

export async function obtenerCierreMes(anio, mes) {
  const { data, error } = await supabase
    .from("cierres_mes_verificados")
    .select("*")
    .eq("anio", anio)
    .eq("mes", mes)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Días del mes con algún cobro cargado (General u Ortodoncia) que todavía
// no tienen su Cierre Diario aprobado — hay que cerrarlos antes de poder
// cerrar el mes completo.
export async function obtenerDiasPendientesDelMes(anio, mes) {
  const { inicio, fin } = rangoDelMes(anio, mes);

  const [{ data: cobrosGeneral, error: e1 }, { data: cobrosOrto, error: e2 }, cierres] = await Promise.all([
    supabase.from("caja_general").select("fecha").gte("fecha", inicio).lte("fecha", fin),
    supabase.from("caja_ortodoncia").select("fecha").gte("fecha", inicio).lte("fecha", fin),
    obtenerCierresDelMes(inicio, fin),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const fechasConActividad = new Set([...(cobrosGeneral || []).map((c) => c.fecha), ...(cobrosOrto || []).map((c) => c.fecha)]);
  const fechasAprobadas = new Set((cierres || []).map((c) => c.fecha));

  return Array.from(fechasConActividad)
    .filter((f) => !fechasAprobadas.has(f))
    .sort();
}

const aCentavos = (n) => Math.round(Number(n) * 100) / 100;

// Cómo se reparte el balance del mes entre las dos cuentas de la reserva de Consultorio: lo que es efectivo
// (ingresos en efectivo menos lo pagado en efectivo) queda como efectivo y todo lo demás entra al banco.
// Los dos números pueden ser negativos (si en efectivo se pagó más de lo que entró, el banco compensa).
export function repartirBalance(balance) {
  const efectivo = aCentavos((balance?.netoPorMedioPago || []).find((f) => f.clave === "Efectivo")?.monto || 0);
  const banco = aCentavos((Number(balance?.balance) || 0) - efectivo);
  return { efectivo, banco };
}

// Si ya había un movimiento de Consultorio de un cierre anterior de este
// mismo mes (por ejemplo, se reabrió para corregir algo y se está
// volviendo a cerrar), se borra antes de cargar el nuevo — así el pozo
// nunca queda con dos depósitos del mismo mes ni con uno desactualizado.
async function borrarDepositoAnterior(anio, mes) {
  const { data, error } = await supabase
    .from("cierres_mes_verificados")
    .select("movimiento_consultorio_id, movimiento_consultorio_efectivo_id")
    .eq("anio", anio)
    .eq("mes", mes)
    .maybeSingle();
  if (error) throw error;
  const ids = [data?.movimiento_consultorio_id, data?.movimiento_consultorio_efectivo_id].filter(Boolean);
  if (ids.length > 0) {
    // El cierre apunta a estos movimientos: primero se lo desenlaza, si no la base no deja borrarlos.
    const { error: errorDesenlazar } = await supabase
      .from("cierres_mes_verificados")
      .update({ movimiento_consultorio_id: null, movimiento_consultorio_efectivo_id: null })
      .eq("anio", anio)
      .eq("mes", mes);
    if (errorDesenlazar) throw errorDesenlazar;
    const { error: errorBorrar } = await supabase.from("movimientos_personales").delete().in("id", ids);
    if (errorBorrar) throw errorBorrar;
  }
}

export async function aprobarCierreMes(anio, mes, usuarioId, nombreDuena, observaciones, detalle) {
  if (esMesDePrueba(anio, mes)) {
    throw new Error(`${NOMBRES_MES[mes - 1]} ${anio} fue un mes de prueba y no se cierra.`);
  }
  const { inicio, fin } = rangoDelMes(anio, mes);

  await borrarDepositoAnterior(anio, mes);

  // La ganancia (o pérdida) limpia del mes pasa a la reserva de
  // Consultorio — es el "pozo" que sigue financiando el mes que viene.
  // Va en dos movimientos: lo que es efectivo a la cuenta Efectivo y el resto (todo lo que entró a la cuenta
  // del banco) a la cuenta Banco.
  const reparto = repartirBalance(detalle);
  const depositar = async (cuenta, monto) => {
    if (Math.abs(monto) < 0.005) return null;
    const esIngreso = monto >= 0;
    return crearMovimientoPersonal({
      panel: "Consultorio",
      cuenta,
      tipo: esIngreso ? "Ingreso" : "Egreso",
      categoria: esIngreso ? "Otro ingreso" : "Otro egreso",
      monto: Math.abs(monto),
      fecha: fin,
      descripcion: `Balance neto (${cuenta === "Efectivo" ? "efectivo" : "banco"}) — ${NOMBRES_MES[mes - 1]} ${anio}`,
    });
  };
  const movimientoBanco = await depositar("Banco", reparto.banco);
  let movimientoEfectivo = null;
  try {
    movimientoEfectivo = await depositar("Efectivo", reparto.efectivo);
  } catch (e) {
    if (movimientoBanco) await eliminarMovimientoPersonal(movimientoBanco);
    throw e;
  }

  const { error: errorMes } = await supabase.from("cierres_mes_verificados").upsert(
    {
      anio,
      mes,
      usuario_id: usuarioId,
      nombre_duena: nombreDuena || null,
      aprobado_en: new Date().toISOString(),
      observaciones: observaciones || null,
      detalle: detalle ? { ...detalle, reparto } : null,
      movimiento_consultorio_id: movimientoBanco?.id || null,
      movimiento_consultorio_efectivo_id: movimientoEfectivo?.id || null,
    },
    { onConflict: "anio,mes" }
  );
  if (errorMes) throw errorMes;

  const [{ error: errorGastos }, { error: errorPagos }] = await Promise.all([
    supabase.from("gastos").update({ cerrado: true }).gte("fecha", inicio).lte("fecha", fin),
    supabase.from("pagos_profesionales").update({ cerrado: true }).gte("fecha", inicio).lte("fecha", fin),
  ]);
  if (errorGastos) throw errorGastos;
  if (errorPagos) throw errorPagos;
}

// Para el puntito rojo del menú — se fija solo en el último mes ya
// terminado (el anterior al actual). Si tuvo actividad y todavía no se
// aprobó su cierre, avisa. No mira meses más viejos para no generar un
// aviso gigante con historial de antes de que existiera esta función.
export async function obtenerCantidadMesesPendientesAprobar() {
  const hoyReal = new Date();
  let mes = hoyReal.getMonth(); // mes actual (1-based) menos 1 = mes anterior
  let anio = hoyReal.getFullYear();
  if (mes === 0) {
    mes = 12;
    anio -= 1;
  }

  if (esMesDePrueba(anio, mes)) return 0;

  const aprobado = await obtenerCierreMes(anio, mes);
  if (aprobado) return 0;

  const { inicio, fin } = rangoDelMes(anio, mes);
  const [{ count: cGeneral, error: e1 }, { count: cOrto, error: e2 }] = await Promise.all([
    supabase.from("caja_general").select("id", { count: "exact", head: true }).gte("fecha", inicio).lte("fecha", fin),
    supabase.from("caja_ortodoncia").select("id", { count: "exact", head: true }).gte("fecha", inicio).lte("fecha", fin),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  return (cGeneral || 0) > 0 || (cOrto || 0) > 0 ? 1 : 0;
}

// Solo la Dueña puede reabrir un mes ya cerrado: desbloquea gastos y pagos
// a profesionales de ese mes, saca de Consultorio el depósito que se
// había hecho al cerrar (porque el balance puede cambiar mientras esté
// reabierto), y manda el cierre a la papelera para poder corregir algo y
// volver a cerrar más adelante.
export async function reabrirCierreMes(anio, mes) {
  const { inicio, fin } = rangoDelMes(anio, mes);

  const [{ error: errorGastos }, { error: errorPagos }] = await Promise.all([
    supabase.from("gastos").update({ cerrado: false }).gte("fecha", inicio).lte("fecha", fin),
    supabase.from("pagos_profesionales").update({ cerrado: false }).gte("fecha", inicio).lte("fecha", fin),
  ]);
  if (errorGastos) throw errorGastos;
  if (errorPagos) throw errorPagos;

  await borrarDepositoAnterior(anio, mes);

  const { data, error } = await supabase.from("cierres_mes_verificados").select("anio, mes").eq("anio", anio).eq("mes", mes).maybeSingle();
  if (error) throw error;
  if (data) {
    await moverAPapelera("cierres_mes_verificados", { anio, mes });
  }
}
