import { supabase } from "@/lib/supabaseClient";

export async function obtenerRankingPrestaciones(fechaInicio, fechaFin) {
  const [{ data: cobrosGeneral, error: eg }, { data: cobrosOrto, error: eo }] = await Promise.all([
    supabase.from("caja_general").select("prestaciones").gte("fecha", fechaInicio).lte("fecha", fechaFin),
    supabase.from("caja_ortodoncia").select("concepto, importe").gte("fecha", fechaInicio).lte("fecha", fechaFin),
  ]);
  if (eg) throw eg;
  if (eo) throw eo;

  const porPrestacion = {};
  function obtenerEntrada(nombre, especialidad) {
    const clave = `${especialidad}::${nombre}`;
    if (!porPrestacion[clave]) {
      porPrestacion[clave] = { nombre, especialidad, cantidad: 0, monto: 0 };
    }
    return porPrestacion[clave];
  }

  for (const c of cobrosGeneral || []) {
    for (const p of c.prestaciones || []) {
      if (!p.prestacion) continue;
      const entrada = obtenerEntrada(p.prestacion, "General");
      const cantidad = Number(p.cantidad || 1);
      entrada.cantidad += cantidad;
      entrada.monto += Number(p.valor || 0) * cantidad;
    }
  }

  for (const c of cobrosOrto || []) {
    const entrada = obtenerEntrada(c.concepto, "Ortodoncia");
    entrada.cantidad += 1;
    entrada.monto += Number(c.importe || 0);
  }

  const filas = Object.values(porPrestacion);
  const totalCantidad = filas.reduce((acc, f) => acc + f.cantidad, 0);
  const totalMonto = filas.reduce((acc, f) => acc + f.monto, 0);
  filas.forEach((f) => {
    f.porcentajeCantidad = totalCantidad > 0 ? (f.cantidad / totalCantidad) * 100 : 0;
    f.porcentajeMonto = totalMonto > 0 ? (f.monto / totalMonto) * 100 : 0;
  });
  return { filas, totalCantidad, totalMonto };
}
