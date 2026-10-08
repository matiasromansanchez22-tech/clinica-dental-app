import { supabase } from "@/lib/supabaseClient";

// Las obras sociales están cargadas a mano y a veces cambia la mayúscula
// ("IAPOS" / "Iapos", "AVALIAN" / "Avalian"). Para agrupar se compara sin
// mayúsculas y se muestra con la forma más usada.
function claveObraSocial(cobertura) {
  return (cobertura || "Sin dato").trim().toLowerCase();
}

// Cobros de Caja General del período, con quién atendió, la cobertura y el
// paciente. Se pagina de a 1000 porque la base corta ahí.
export async function obtenerCobrosParaResumen(fechaDesde, fechaHasta) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    let consulta = supabase
      .from("caja_general")
      .select(
        `fecha, cobertura, paciente_id, profesional_atencion_id, prestaciones,
         paciente:pacientes(apellido_y_nombre),
         profesional:profesionales!profesional_atencion_id(nombre)`
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
  return filas;
}

// Arma: profesional → obra social → pacientes (con cuántas veces vino, cuántas
// prestaciones se le hicieron y la última fecha).
export function armarResumen(cobros) {
  const nombresPorClave = new Map(); // clave → { nombre → veces } para elegir cómo mostrar
  const profesionales = new Map();

  for (const c of cobros) {
    const clave = claveObraSocial(c.cobertura);
    const nombresUsados = nombresPorClave.get(clave) || new Map();
    const nombre = (c.cobertura || "Sin dato").trim();
    nombresUsados.set(nombre, (nombresUsados.get(nombre) || 0) + 1);
    nombresPorClave.set(clave, nombresUsados);

    const profId = c.profesional_atencion_id || "sin-asignar";
    if (!profesionales.has(profId)) {
      profesionales.set(profId, {
        id: profId,
        nombre: c.profesional?.nombre ?? "(sin profesional asignado)",
        obrasSociales: new Map(),
      });
    }
    const prof = profesionales.get(profId);
    if (!prof.obrasSociales.has(clave)) prof.obrasSociales.set(clave, { clave, pacientes: new Map() });
    const grupo = prof.obrasSociales.get(clave);

    const pacId = c.paciente_id || `sin-${c.fecha}`;
    if (!grupo.pacientes.has(pacId)) {
      grupo.pacientes.set(pacId, {
        id: pacId,
        paciente: c.paciente?.apellido_y_nombre?.trim() ?? "(sin nombre)",
        visitas: new Set(),
        prestaciones: 0,
        ultimaFecha: c.fecha,
      });
    }
    const pac = grupo.pacientes.get(pacId);
    pac.visitas.add(c.fecha);
    pac.prestaciones += (c.prestaciones || []).reduce((s, p) => s + (Number(p.cantidad) || 1), 0);
    if (c.fecha > pac.ultimaFecha) pac.ultimaFecha = c.fecha;
  }

  const nombreMostrado = (clave) => {
    const usados = nombresPorClave.get(clave);
    return [...usados.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };

  return [...profesionales.values()]
    .map((prof) => ({
      id: prof.id,
      nombre: prof.nombre,
      obrasSociales: [...prof.obrasSociales.values()]
        .map((g) => ({
          clave: g.clave,
          nombre: nombreMostrado(g.clave),
          pacientes: [...g.pacientes.values()]
            .map((p) => ({ ...p, visitas: p.visitas.size }))
            .sort((a, b) => a.paciente.localeCompare(b.paciente, "es")),
        }))
        .sort((a, b) => b.pacientes.length - a.pacientes.length || a.nombre.localeCompare(b.nombre, "es")),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
