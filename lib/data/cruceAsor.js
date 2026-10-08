import { supabase } from "@/lib/supabaseClient";

// ---------- Normalizaciones ----------

function sinAcentos(texto) {
  return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function claveObraSocialAsor(nombre) {
  return sinAcentos(nombre).trim().toLowerCase();
}

// "Ferrero, Santiago" y "FERRERO SANTIAGO" son la misma persona: se comparan
// las palabras sin acentos ni orden.
function claveNombre(nombre) {
  return sinAcentos(nombre)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function soloDigitos(texto) {
  return (texto || "").replace(/\D/g, "");
}

function clavePaciente(dni, nombre) {
  const d = soloDigitos(dni);
  return d.length >= 6 ? `dni:${d}` : `nom:${claveNombre(nombre)}`;
}

// ASOR escribe los códigos con 5-6 cifras (20100, 100100) y en el nomenclador
// de la app a veces están abreviados (201, 1001, "02.16"). Para compararlos
// se dejan solo los números, sin ceros a la izquierda, y los cortos (hasta 4
// cifras) se completan con "00".
export function normalizarCodigo(codigo) {
  let digitos = (codigo || "").replace(/o/gi, "0").replace(/\D/g, "").replace(/^0+/, "");
  if (!digitos) return "";
  if (digitos.length <= 4) digitos += "00";
  return digitos;
}

// ---------- Datos ----------

export async function obtenerLineasAsor() {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("facturacion_asor_pacientes")
      .select("*")
      .order("created_at")
      .range(desde, desde + 999);
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas;
}

export async function obtenerFichasParaCruce(fechaDesde, fechaHasta) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    let consulta = supabase
      .from("facturacion_obras_sociales")
      .select(
        `id, fecha, dni, obra_social, prestacion, codigo, cantidad, valor_os, sin_honorarios,
         paciente:pacientes(apellido_y_nombre, dni),
         profesional:profesionales(nombre)`
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

// ---------- Cruce ----------

// En ASOR hay renglones que no son una prestación (estampilla, recupero de
// costo administrativo, encabezados mal leídos del PDF): tienen total 0 o no
// traen código. Solo se cruzan los que son una prestación de verdad.
function esPrestacionAsor(l) {
  return Boolean(l.codigo_prestacion) && Number(l.total_prestacion) !== 0;
}

export const ESTADOS = {
  coincide: "Coincide",
  diferencia: "Diferencias",
  soloAsor: "Solo en ASOR",
  soloApp: "Solo en la app",
};

// Cruza lo que informó ASOR contra lo cargado en la app, paciente por
// paciente. Cada prestación de ASOR se empareja con una de la app del mismo
// paciente: primero igual código e importe; después igual código con otro
// importe. Lo que sobra de cada lado queda "solo en ASOR" / "solo en la app".
// De la app solo se consideran las obras sociales que vinieron en el archivo
// de ASOR (si no, todo lo demás aparecería como "faltante").
export function cruzar(lineasAsor, fichasApp) {
  const obrasSocialesAsor = new Set(lineasAsor.map((l) => claveObraSocialAsor(l.obra_social)));
  const pacientes = new Map();

  // "Iapos" / "IAPOS" / "Jerárquicos" / "Jerarquicos": se muestra con el nombre
  // que usa ASOR (o el primero que aparezca) y se agrupa como una sola.
  const nombresMostrados = new Map();
  for (const l of lineasAsor) {
    const k = claveObraSocialAsor(l.obra_social);
    if (!nombresMostrados.has(k)) nombresMostrados.set(k, l.obra_social.trim());
  }
  const nombreObraSocial = (n) => nombresMostrados.get(claveObraSocialAsor(n)) ?? (n || "Sin dato").trim();

  const obtener = (clave, nombre, dni) => {
    if (!pacientes.has(clave)) {
      pacientes.set(clave, { clave, nombre, dni: soloDigitos(dni) || null, obraSocial: null, asor: [], app: [] });
    }
    return pacientes.get(clave);
  };

  for (const l of lineasAsor.filter(esPrestacionAsor)) {
    const p = obtener(clavePaciente(l.nro_doc, l.paciente), l.paciente, l.nro_doc);
    p.obraSocial = nombreObraSocial(l.obra_social);
    p.asor.push({
      codigo: l.codigo_prestacion,
      codigoNormalizado: normalizarCodigo(l.codigo_prestacion),
      concepto: l.concepto,
      importe: Number(l.total_prestacion),
      pendiente: Number(l.pendiente_liquidar),
      nroPresupuesto: l.nro_presupuesto,
      usada: false,
    });
  }

  for (const f of fichasApp) {
    if (!obrasSocialesAsor.has(claveObraSocialAsor(f.obra_social))) continue;
    const nombre = f.paciente?.apellido_y_nombre?.trim() ?? "(sin nombre)";
    const dni = f.dni || f.paciente?.dni;
    // La estampilla se cobra pero no es una prestación para cruzar.
    if (f.sin_honorarios && /estampilla/i.test(f.prestacion || "")) continue;
    if (/estampilla/i.test(f.prestacion || "")) continue;
    const p = obtener(clavePaciente(dni, nombre), nombre, dni);
    if (!p.obraSocial) p.obraSocial = nombreObraSocial(f.obra_social);
    for (let i = 0; i < (Number(f.cantidad) || 1); i++) {
      p.app.push({
        fecha: f.fecha,
        codigo: f.codigo,
        codigoNormalizado: normalizarCodigo(f.codigo),
        prestacion: f.prestacion,
        importe: Number(f.valor_os) || 0,
        profesional: f.profesional?.nombre ?? "(sin asignar)",
        usada: false,
      });
    }
  }

  const resultado = [];
  for (const p of pacientes.values()) {
    const lineas = [];

    // 1) mismo código e importe
    for (const a of p.asor) {
      const par = p.app.find(
        (x) => !x.usada && x.codigoNormalizado === a.codigoNormalizado && Math.abs(x.importe - a.importe) < 1
      );
      if (par) {
        a.usada = par.usada = true;
        lineas.push({ estado: "coincide", asor: a, app: par });
      }
    }
    // 2) mismo código, distinto importe
    for (const a of p.asor.filter((x) => !x.usada)) {
      const par = p.app.find((x) => !x.usada && x.codigoNormalizado === a.codigoNormalizado);
      if (par) {
        a.usada = par.usada = true;
        lineas.push({ estado: "importeDistinto", asor: a, app: par });
      }
    }
    // 3) lo que quedó sin pareja
    for (const a of p.asor.filter((x) => !x.usada)) lineas.push({ estado: "soloAsor", asor: a, app: null });
    for (const x of p.app.filter((y) => !y.usada)) lineas.push({ estado: "soloApp", asor: null, app: x });

    const hayAsor = lineas.some((l) => l.asor);
    const hayApp = lineas.some((l) => l.app);
    const todoCoincide = lineas.every((l) => l.estado === "coincide");
    let estado;
    if (todoCoincide) estado = "coincide";
    else if (hayAsor && !hayApp) estado = "soloAsor";
    else if (hayApp && !hayAsor) estado = "soloApp";
    else estado = "diferencia";

    resultado.push({
      clave: p.clave,
      paciente: p.nombre,
      dni: p.dni,
      obraSocial: p.obraSocial || "Sin dato",
      estado,
      lineas,
      totalAsor: lineas.reduce((s, l) => s + (l.asor ? l.asor.importe : 0), 0),
      pendienteAsor: lineas.reduce((s, l) => s + (l.asor ? l.asor.pendiente : 0), 0),
      totalApp: lineas.reduce((s, l) => s + (l.app ? l.app.importe : 0), 0),
    });
  }
  return resultado.sort(
    (a, b) => a.obraSocial.localeCompare(b.obraSocial, "es") || a.paciente.localeCompare(b.paciente, "es")
  );
}
