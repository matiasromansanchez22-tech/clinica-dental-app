import { supabase } from "@/lib/supabaseClient";

// Detecta pagos que parecen cargados dos veces: mismo monto, fechas cercanas y la misma persona (por ejemplo, un honorario de
// Caja y un "Sueldos" con el mismo nombre). No bloquea nada: avisa para que alguien confirme si son dos pagos distintos.

const MONTO_MINIMO = 20000; // por debajo de esto hay muchos pagos chicos repetidos (cadete, librería) que no son sospechosos
const DIAS_CERCANOS = 7;
const PALABRAS_SUELTAS = new Set([
  "pago", "pagos", "sueldo", "sueldos", "honorarios", "honorario", "transferencia", "efectivo", "cuota", "mercado", "septiembre",
  "octubre", "noviembre", "diciembre", "agosto", "copago", "particular", "caja", "control", "alquiler", "marketing",
]);

function sinAcentos(texto) {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function palabras(texto) {
  return new Set(
    sinAcentos(texto)
      .split(/[^a-z0-9ñ]+/)
      .filter((p) => p.length >= 4 && !PALABRAS_SUELTAS.has(p))
  );
}

function diasEntre(a, b) {
  return Math.abs((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000);
}

// `a` y `b`: { tabla, id, fecha, monto, quien (texto con el nombre o la descripción), profesionalId? }
export function sonPosibleDuplicado(a, b) {
  if (a.tabla === b.tabla && a.id === b.id) return false;
  if (Math.abs(a.monto - b.monto) >= 1 || a.monto < MONTO_MINIMO) return false;
  if (diasEntre(a.fecha, b.fecha) > DIAS_CERCANOS) return false;
  if (a.profesionalId && a.profesionalId === b.profesionalId) return true;
  const pa = palabras(a.quien);
  for (const p of palabras(b.quien)) if (pa.has(p)) return true;
  return false;
}

function normalizarGasto(g) {
  return { tabla: "gastos", id: g.id, fecha: g.fecha, monto: Number(g.monto), quien: `${g.descripcion || ""} ${g.observaciones || ""}`, categoria: g.categoria, medioPago: g.medio_pago, etiqueta: `Gasto "${g.descripcion || g.categoria}"` };
}

function normalizarPago(p) {
  const nombre = p.profesional?.nombre || "";
  return { tabla: "pagos_profesionales", id: p.id, fecha: p.fecha, monto: Number(p.monto), quien: `${nombre} ${p.observaciones || ""}`, profesionalId: p.profesional_id, medioPago: p.medio_pago, etiqueta: `Honorario de ${nombre || "un profesional"}` };
}

function sumarDias(fechaISO, dias) {
  const d = new Date(`${fechaISO}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function traerCercanos(fecha, monto) {
  const desde = sumarDias(fecha, -DIAS_CERCANOS);
  const hasta = sumarDias(fecha, DIAS_CERCANOS);
  const [gastos, pagos] = await Promise.all([
    supabase.from("gastos").select("id, fecha, monto, descripcion, observaciones, categoria, medio_pago").eq("monto", monto).gte("fecha", desde).lte("fecha", hasta),
    supabase.from("pagos_profesionales").select("id, fecha, monto, observaciones, profesional_id, medio_pago, profesional:profesionales(nombre)").eq("monto", monto).gte("fecha", desde).lte("fecha", hasta),
  ]);
  return [...(gastos.data || []).map(normalizarGasto), ...(pagos.data || []).map(normalizarPago)];
}

// Antes de guardar un gasto o un pago nuevo: devuelve los ya cargados que se le parecen (vacío si no hay ninguno o si la
// consulta falla: el control nunca debe impedir cargar).
export async function buscarPosiblesDuplicados({ tabla, fecha, monto, quien, profesionalId, excluirId }) {
  try {
    const nuevo = { tabla, id: "nuevo", fecha, monto: Number(monto), quien: quien || "", profesionalId };
    if (!nuevo.monto || nuevo.monto < MONTO_MINIMO) return [];
    const cercanos = await traerCercanos(fecha, nuevo.monto);
    return cercanos.filter((c) => c.id !== excluirId && sonPosibleDuplicado(nuevo, c));
  } catch {
    return [];
  }
}

export function mensajeDeDuplicados(duplicados, monto) {
  const lista = duplicados
    .slice(0, 3)
    .map((d) => `• ${d.etiqueta} — $${Math.round(d.monto).toLocaleString("es-AR")} el ${d.fecha.split("-").reverse().join("/")} (${d.medioPago})`)
    .join("\n");
  return `Ya hay cargado algo parecido:\n\n${lista}\n\n¿Es el mismo pago de $${Math.round(Number(monto)).toLocaleString("es-AR")}? Si es el mismo, no lo cargues otra vez. ¿Cargarlo igual?`;
}

// Todos los pares sospechosos de los últimos `dias` días (para la pantalla "Qué revisar").
export async function obtenerParesDuplicados(desdeISO) {
  const [gastos, pagos] = await Promise.all([
    supabase.from("gastos").select("id, fecha, monto, descripcion, observaciones, categoria, medio_pago, created_at").gte("fecha", desdeISO).gte("monto", MONTO_MINIMO),
    supabase.from("pagos_profesionales").select("id, fecha, monto, observaciones, profesional_id, medio_pago, created_at, profesional:profesionales(nombre)").gte("fecha", desdeISO).gte("monto", MONTO_MINIMO),
  ]);
  if (gastos.error) throw gastos.error;
  if (pagos.error) throw pagos.error;
  const todos = [...(gastos.data || []).map((g) => ({ ...normalizarGasto(g), creado: g.created_at })), ...(pagos.data || []).map((p) => ({ ...normalizarPago(p), creado: p.created_at }))];
  const pares = [];
  for (let i = 0; i < todos.length; i++) {
    for (let j = i + 1; j < todos.length; j++) {
      if (sonPosibleDuplicado(todos[i], todos[j])) {
        const [a, b] = [todos[i], todos[j]].sort((x, y) => (x.creado < y.creado ? -1 : 1));
        pares.push({ clave: `duplicado:${a.id}|${b.id}`, a, b });
      }
    }
  }
  return pares;
}
