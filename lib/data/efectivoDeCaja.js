import { supabase } from "@/lib/supabaseClient";
import { gastoSaleDeLaReserva, obtenerCategoriasGasto } from "@/lib/data/gastos";

// Movimientos de EFECTIVO de una caja en un día, que no son cobros: pagos a profesionales,
// gastos y transferencias entre cajas. Usa el mismo criterio que las pantallas de Caja
// ("Disponible después de pagos"), para que el Cierre de Turno diga lo mismo que Caja.
//
//   caja: "General" | "Ortodoncia"
//   devuelve { salidas: [{ etiqueta, monto }], entradas: [{ etiqueta, monto }], neto }
//   (neto = entradas − salidas: lo que hay que sumarle a lo cobrado en efectivo)
export async function calcularMovimientosEfectivoDeCaja(fecha, caja) {
  const otra = caja === "General" ? "Ortodoncia" : "General";
  const [gastosRes, pagosRes, transfRes, categorias] = await Promise.all([
    supabase.from("gastos").select("categoria, descripcion, monto, medio_pago, especialidad, desde_reserva").eq("fecha", fecha).eq("medio_pago", "Efectivo"),
    supabase
      .from("pagos_profesionales")
      .select("monto, medio_pago, origen, desde_reserva, profesional:profesionales(nombre, especialidad)")
      .eq("fecha", fecha)
      .eq("origen", "Caja")
      .eq("desde_reserva", false)
      .eq("medio_pago", "Efectivo"),
    supabase.from("transferencias_caja").select("monto, origen, destino, medio_pago").eq("fecha", fecha).eq("medio_pago", "Efectivo"),
    obtenerCategoriasGasto(),
  ]);
  for (const r of [gastosRes, pagosRes, transfRes]) if (r.error) throw r.error;

  const categoriasReserva = new Set(categorias.filter((c) => c.sale_de_reserva).map((c) => c.nombre));
  const salidas = [];
  const entradas = [];

  for (const g of gastosRes.data) {
    if (gastoSaleDeLaReserva(g, categoriasReserva)) continue;
    // Mismo reparto entre cajas que usan las pantallas de Caja.
    const esDeEstaCaja = caja === "General" ? g.especialidad !== "Ortodoncia" : g.especialidad !== "General";
    if (esDeEstaCaja) salidas.push({ etiqueta: `Gasto: ${g.descripcion || g.categoria}`, monto: Number(g.monto) });
  }
  for (const p of pagosRes.data) {
    const esOrto = p.profesional?.especialidad === "Ortodoncia";
    const esDeEstaCaja = caja === "General" ? !esOrto : esOrto;
    if (esDeEstaCaja) salidas.push({ etiqueta: `Pago a ${p.profesional?.nombre ?? "profesional"}`, monto: Number(p.monto) });
  }
  for (const t of transfRes.data) {
    if (t.origen === caja) salidas.push({ etiqueta: `Transferencia a Caja ${otra}`, monto: Number(t.monto) });
    if (t.destino === caja) entradas.push({ etiqueta: `Transferencia desde Caja ${otra}`, monto: Number(t.monto) });
  }

  const totalSalidas = salidas.reduce((a, s) => a + s.monto, 0);
  const totalEntradas = entradas.reduce((a, s) => a + s.monto, 0);
  return { salidas, entradas, totalSalidas, totalEntradas, neto: totalEntradas - totalSalidas };
}
