import { supabase } from "@/lib/supabaseClient";

// Las obras sociales están cargadas a mano y a veces cambia la mayúscula
// ("IAPOS" / "Iapos", "AVALIAN" / "Avalian"). Para agrupar se compara sin
// mayúsculas y se muestra con la forma más usada.
function claveObraSocial(nombre) {
  return (nombre || "Sin dato").trim().toLowerCase();
}

// Todo lo que se facturó a obras sociales en el período, prestación por
// prestación: quién es el paciente, qué se le hizo, quién lo atendió, el
// código y el valor que paga la obra social. Es la misma base que usan
// Control de Obras Sociales y Pagos ASOR, así que los números coinciden
// con lo que después se concilia. Se pagina de a 1000 porque la base corta
// ahí.
export async function obtenerPrestacionesPorObraSocial(fechaDesde, fechaHasta) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    let consulta = supabase
      .from("facturacion_obras_sociales")
      .select(
        `id, fecha, dni, obra_social, numero_afiliado, prestacion, codigo, cantidad, valor_os,
         estado_ficha, pago_asor_id, paciente_id, profesional_id, sin_honorarios,
         paciente:pacientes(apellido_y_nombre),
         profesional:profesionales(nombre, porcentaje_honorarios_os)`
      )
      .order("fecha")
      .range(desde, desde + 999);
    if (fechaDesde) consulta = consulta.gte("fecha", fechaDesde);
    if (fechaHasta) consulta = consulta.lte("fecha", fechaHasta);
    const { data, error } = await consulta;
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    obraSocial: (f.obra_social || "Sin dato").trim(),
    claveObraSocial: claveObraSocial(f.obra_social),
    pacienteId: f.paciente_id,
    paciente: f.paciente?.apellido_y_nombre?.trim() ?? "(sin nombre)",
    dni: f.dni,
    numeroAfiliado: f.numero_afiliado,
    prestacion: f.prestacion,
    codigo: f.codigo,
    cantidad: Number(f.cantidad) || 1,
    valorOS: Number(f.valor_os) || 0,
    estado: f.estado_ficha,
    pagoAsorId: f.pago_asor_id,
    profesionalId: f.profesional_id,
    profesional: f.profesional?.nombre ?? "(sin asignar)",
    porcentajeHonorarios: Number(f.profesional?.porcentaje_honorarios_os ?? 20),
    // La estampilla nunca se liquida al profesional (aunque alguna haya quedado
    // cargada sin la marca de "sin honorarios").
    sinHonorarios: Boolean(f.sin_honorarios) || /estampilla/i.test(f.prestacion || ""),
  }));
}

// Total de la prestación a cobrar a la obra social y lo que le corresponde al
// profesional de honorarios (0 si no se liquida, como la estampilla).
export function totalOS(f) {
  return f.valorOS * f.cantidad;
}
export function honorariosDe(f) {
  return f.sinHonorarios ? 0 : totalOS(f) * (f.porcentajeHonorarios / 100);
}

// Resumen para liquidar: por profesional, cuánto se facturó, cuánto no se
// liquida (estampillas y similares) y cuánto hay que pagarle.
export function resumenParaLiquidar(prestaciones) {
  const porProf = new Map();
  for (const f of prestaciones) {
    const id = f.profesionalId ?? "sin-asignar";
    if (!porProf.has(id)) {
      porProf.set(id, {
        id, nombre: f.profesional, porcentaje: f.porcentajeHonorarios,
        prestaciones: 0, facturado: 0, sinLiquidar: 0, baseLiquidable: 0, honorarios: 0,
      });
    }
    const r = porProf.get(id);
    const total = totalOS(f);
    r.prestaciones += f.cantidad;
    r.facturado += total;
    if (f.sinHonorarios) r.sinLiquidar += total;
    else r.baseLiquidable += total;
    r.honorarios += honorariosDe(f);
  }
  return [...porProf.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

// Arma: obra social → prestaciones (ordenadas por paciente y fecha), con los
// totales de cada obra social. El valor de cada fila es el valor de UNA
// prestación; el total de la fila es valor × cantidad.
export function agruparPorObraSocial(prestaciones) {
  const grupos = new Map();
  const nombresUsados = new Map();

  for (const p of prestaciones) {
    const usados = nombresUsados.get(p.claveObraSocial) || new Map();
    usados.set(p.obraSocial, (usados.get(p.obraSocial) || 0) + 1);
    nombresUsados.set(p.claveObraSocial, usados);

    if (!grupos.has(p.claveObraSocial)) {
      grupos.set(p.claveObraSocial, { clave: p.claveObraSocial, filas: [] });
    }
    grupos.get(p.claveObraSocial).filas.push(p);
  }

  return [...grupos.values()]
    .map((g) => {
      const filas = [...g.filas].sort(
        (a, b) => a.paciente.localeCompare(b.paciente, "es") || a.fecha.localeCompare(b.fecha)
      );
      return {
        clave: g.clave,
        nombre: [...nombresUsados.get(g.clave).entries()].sort((a, b) => b[1] - a[1])[0][0],
        filas,
        pacientes: new Set(filas.map((f) => f.pacienteId)).size,
        prestaciones: filas.reduce((s, f) => s + f.cantidad, 0),
        total: filas.reduce((s, f) => s + totalOS(f), 0),
        honorarios: filas.reduce((s, f) => s + honorariosDe(f), 0),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
