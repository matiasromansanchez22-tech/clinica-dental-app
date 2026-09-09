import { supabase } from "@/lib/supabaseClient";

function mapearFila(f) {
  return {
    anio: f.anio,
    mes: f.mes,
    ingresosObjetivo: f.ingresos_objetivo === null ? null : Number(f.ingresos_objetivo),
    balanceObjetivo: f.balance_objetivo === null ? null : Number(f.balance_objetivo),
    pacientesNuevosObjetivo: f.pacientes_nuevos_objetivo,
    observaciones: f.observaciones,
  };
}

function metaVacia(anio, mes) {
  return { anio, mes, ingresosObjetivo: null, balanceObjetivo: null, pacientesNuevosObjetivo: null, observaciones: null };
}

export async function obtenerMetaMes(anio, mes) {
  const { data, error } = await supabase
    .from("metas_mensuales")
    .select("*")
    .eq("anio", anio)
    .eq("mes", mes)
    .maybeSingle();
  if (error) throw error;
  return data ? mapearFila(data) : metaVacia(anio, mes);
}

export async function guardarMetaMes(anio, mes, datos) {
  const { data, error } = await supabase
    .from("metas_mensuales")
    .upsert(
      {
        anio,
        mes,
        ingresos_objetivo: datos.ingresosObjetivo === "" || datos.ingresosObjetivo == null ? null : Number(datos.ingresosObjetivo),
        balance_objetivo: datos.balanceObjetivo === "" || datos.balanceObjetivo == null ? null : Number(datos.balanceObjetivo),
        pacientes_nuevos_objetivo:
          datos.pacientesNuevosObjetivo === "" || datos.pacientesNuevosObjetivo == null
            ? null
            : Number(datos.pacientesNuevosObjetivo),
        observaciones: datos.observaciones || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "anio,mes" }
    )
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

// Últimos N meses (incluyendo el actual) con su meta, aunque no la hayan
// definido — para el historial de seguimiento.
export async function obtenerMetasHistorial(mesesAtras = 6) {
  const hoy = new Date();
  const meses = [];
  for (let i = mesesAtras - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  }

  const { data, error } = await supabase.from("metas_mensuales").select("*");
  if (error) throw error;

  const mapa = {};
  for (const f of data) mapa[`${f.anio}-${f.mes}`] = mapearFila(f);

  return meses.map(({ anio, mes }) => mapa[`${anio}-${mes}`] || metaVacia(anio, mes));
}
