import { supabase } from "@/lib/supabaseClient";

// Todos los cobros de una caja en un rango de fechas (o de siempre), ya "aplanados"
// para mostrarlos en una lista y filtrarlos por texto. Se pagina de a 1000 porque la
// base corta ahí.
//   caja: "General" | "Ortodoncia"
export async function obtenerCobrosParaBuscador(caja, fechaDesde, fechaHasta) {
  const esOrto = caja === "Ortodoncia";
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    let consulta = esOrto
      ? supabase
          .from("caja_ortodoncia")
          .select(
            "id, fecha, importe, medio_pago, desglose_pago, concepto, cerrado, paciente:pacientes_ortodoncia(nombre), ortodoncista:profesionales!ortodoncista_id(nombre)"
          )
      : supabase
          .from("caja_general")
          .select(
            "id, fecha, pago, medio_pago, desglose_pago, cobertura, modalidad, id_documento, numero_cuota, prestaciones, cerrado, paciente:pacientes(apellido_y_nombre), atencion:profesionales!profesional_atencion_id(nombre)"
          );
    consulta = consulta.order("fecha", { ascending: false }).order("created_at", { ascending: false }).range(desde, desde + 999);
    if (fechaDesde) consulta = consulta.gte("fecha", fechaDesde);
    if (fechaHasta) consulta = consulta.lte("fecha", fechaHasta);
    const { data, error } = await consulta;
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }

  return filas.map((f) => {
    const monto = Number(esOrto ? f.importe : f.pago);
    const partes = f.desglose_pago?.length ? f.desglose_pago : [{ medio: f.medio_pago, monto }];
    const medios = [...new Set(partes.map((p) => p.medio))];
    return {
      id: f.id,
      fecha: f.fecha,
      paciente: (esOrto ? f.paciente?.nombre : f.paciente?.apellido_y_nombre)?.trim() ?? "(sin paciente)",
      detalle: esOrto
        ? f.concepto || "—"
        : f.modalidad === "Plan de financiación"
          ? `Plan ${f.id_documento} · ${f.numero_cuota === "Anticipo" ? "Anticipo" : `Cuota ${f.numero_cuota}`}`
          : (f.prestaciones || []).map((p) => p.prestacion).join(", ") || "—",
      cobertura: esOrto ? "Ortodoncia" : f.cobertura || "—",
      atendio: (esOrto ? f.ortodoncista?.nombre : f.atencion?.nombre) ?? "—",
      monto,
      medioTexto: medios.length > 1 ? `Mixto (${medios.join(" + ")})` : medios[0] || "—",
      partes,
      cerrado: Boolean(f.cerrado),
    };
  });
}

function sinAcentos(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Texto libre: cada palabra tiene que aparecer en el paciente, el detalle, la cobertura o
// el profesional; si se escribe un número, también se busca por monto (exacto, o
// escrito con puntos como en pantalla).
export function filtrarCobros(cobros, texto, medio) {
  const palabras = sinAcentos(texto).split(/\s+/).filter(Boolean);
  return cobros.filter((c) => {
    if (medio && medio !== "todos") {
      const coincideMedio = medio === "Mixto" ? c.medioTexto.startsWith("Mixto") : c.partes.some((p) => p.medio === medio);
      if (!coincideMedio) return false;
    }
    if (palabras.length === 0) return true;
    const pajar = sinAcentos(`${c.paciente} ${c.detalle} ${c.cobertura} ${c.atendio} ${c.medioTexto}`);
    return palabras.every((p) => {
      if (pajar.includes(p)) return true;
      const numero = Number(p.replace(/\./g, ""));
      return Number.isFinite(numero) && numero > 0 && Math.round(c.monto) === numero;
    });
  });
}
