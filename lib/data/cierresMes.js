import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";
import { obtenerCierresDelMes } from "@/lib/data/cierresDia";
import { crearMovimientoPersonal } from "@/lib/data/finanzasPersonales";

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

// Si ya había un movimiento de Consultorio de un cierre anterior de este
// mismo mes (por ejemplo, se reabrió para corregir algo y se está
// volviendo a cerrar), se borra antes de cargar el nuevo — así el pozo
// nunca queda con dos depósitos del mismo mes ni con uno desactualizado.
async function borrarDepositoAnterior(anio, mes) {
  const { data, error } = await supabase
    .from("cierres_mes_verificados")
    .select("movimiento_consultorio_id")
    .eq("anio", anio)
    .eq("mes", mes)
    .maybeSingle();
  if (error) throw error;
  if (data?.movimiento_consultorio_id) {
    const { error: errorBorrar } = await supabase
      .from("movimientos_personales")
      .delete()
      .eq("id", data.movimiento_consultorio_id);
    if (errorBorrar) throw errorBorrar;
  }
}

export async function aprobarCierreMes(anio, mes, usuarioId, nombreDuena, observaciones, detalle) {
  const { inicio, fin } = rangoDelMes(anio, mes);

  await borrarDepositoAnterior(anio, mes);

  // La ganancia (o pérdida) limpia del mes pasa a la reserva de
  // Consultorio — es el "pozo" que sigue financiando el mes que viene.
  const balance = Number(detalle?.balance) || 0;
  const esIngreso = balance >= 0;
  const movimiento = await crearMovimientoPersonal({
    panel: "Consultorio",
    cuenta: "Banco",
    tipo: esIngreso ? "Ingreso" : "Egreso",
    categoria: esIngreso ? "Otro ingreso" : "Otro egreso",
    monto: Math.abs(balance),
    fecha: fin,
    descripcion: `Balance neto — ${NOMBRES_MES[mes - 1]} ${anio}`,
  });

  const { error: errorMes } = await supabase.from("cierres_mes_verificados").upsert(
    {
      anio,
      mes,
      usuario_id: usuarioId,
      nombre_duena: nombreDuena || null,
      aprobado_en: new Date().toISOString(),
      observaciones: observaciones || null,
      detalle: detalle || null,
      movimiento_consultorio_id: movimiento.id,
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
