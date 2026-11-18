// La rutina de trabajo del equipo: cada persona tiene una hoja con tareas y las tilda día a día. Acá está el cálculo: qué tareas hizo,
// cuáles las COMPRUEBA el propio sistema (horario marcado, ingreso del profesional, "qué se hizo" cargado, consentimientos, fotos y
// panorámicas) y cuáles son solo declaradas por la persona. Recibe el cliente de Supabase, así corre tanto en el navegador (pantalla
// "Mi rutina de hoy" y control de las Dueñas) como en el servidor (aviso automático).
//
// Estado de cada tarea:
//   verificada   → el sistema comprobó que se hizo (cuenta como hecha, no hace falta tildarla)
//   declarada    → la persona la tildó y el sistema no tiene cómo comprobarla (o todavía no tiene datos): cuenta como hecha
//   contradice   → la persona la tildó pero el sistema dice lo contrario: NO cuenta como hecha
//   insuficiente → la tildó pero el número que puso no alcanza el mínimo que pide la tarea: NO cuenta
//   mal          → sin tildar y el sistema dice que no se cumplió
//   pendiente    → sin tildar y todavía sin comprobante

import { calcularCumplimientoRegistro, sumarDiasISO } from "@/lib/pendientesPorProfesional";
import { calcularResumenJornada, textoDeFecha } from "@/lib/resumenJornada";

export const ESTADOS = {
  verificada: { texto: "Comprobada por el sistema", hecha: true },
  declarada: { texto: "Declarada", hecha: true },
  contradice: { texto: "Tildada, pero el sistema dice que no", hecha: false },
  insuficiente: { texto: "Tildada, pero no llega al mínimo", hecha: false },
  mal: { texto: "No cumplida", hecha: false },
  pendiente: { texto: "Pendiente", hecha: false },
};

export const VERIFICACIONES = {
  horario: "Marcó su horario en la app",
  ingreso_profesional: "Ingreso registrado por Recepción (15 minutos antes)",
  que_se_hizo: "Todos sus pacientes con «qué se hizo» y «qué sigue»",
  cierre_manana: "Resumen de la mañana sin pacientes sin cargar",
  cierre_tarde: "Resumen de la tarde sin pacientes sin cargar",
  consentimientos_manana: "Pacientes de mañana con consentimiento firmado",
  fotos_panoramicas: "Subió fotos o panorámicas hoy",
};

const aMin = (h) => {
  const [a, b] = String(h).slice(0, 5).split(":").map(Number);
  return a * 60 + b;
};

// El próximo día de trabajo (se saltea los domingos).
export function proximoDiaDeTrabajo(fecha) {
  let f = sumarDiasISO(fecha, 1);
  if (new Date(`${f}T12:00:00Z`).getUTCDay() === 0) f = sumarDiasISO(f, 1);
  return f;
}

export const esDomingo = (fecha) => new Date(`${fecha}T12:00:00Z`).getUTCDay() === 0;

// Mínimo que pide una tarea con valor, si lo dice en el texto de la pregunta ("mínimo 60", "tiene que llegar a 100").
export function umbralDeValor(pideValor) {
  const m = String(pideValor || "").match(/(?:m[ií]nimo|llegar a)\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

const lista = (nombres, max = 4) => nombres.slice(0, max).join(", ") + (nombres.length > max ? ` y ${nombres.length - max} más` : "");

// ---- Comprobaciones del sistema. Cada una devuelve { estado: 'ok' | 'mal' | 'sin_datos', detalle } ----
// 'mal' = el sistema ve que NO se cumplió y ya no hay arreglo; 'sin_datos' = todavía falta (o no hay forma de saberlo).

async function dato(ctx, clave, buscar) {
  if (!ctx.cache.has(clave)) ctx.cache.set(clave, Promise.resolve().then(buscar).catch(() => null));
  return ctx.cache.get(clave);
}

// Algo que todavía se puede hacer: si el día ya pasó, es 'mal'; si es hoy, sigue pendiente.
const faltaAun = (ctx, detalle) => ({ estado: ctx.fecha < ctx.hoy ? "mal" : "sin_datos", detalle });

const COMPROBACIONES = {
  async horario(cliente, ctx, persona) {
    const filas = await dato(ctx, "horarios", async () => {
      const { data, error } = await cliente.from("registros_horario").select("usuario_id, hora_entrada").eq("fecha", ctx.fecha);
      if (error) throw error;
      return data;
    });
    if (!filas) return { estado: "sin_datos", detalle: "No se pudo comprobar el horario." };
    const f = filas.find((x) => x.usuario_id === persona.usuarioId && x.hora_entrada);
    return f ? { estado: "ok", detalle: `Marcó su entrada a las ${String(f.hora_entrada).slice(0, 5)}` } : faltaAun(ctx, "No marcó su horario");
  },

  async ingreso_profesional(cliente, ctx, persona) {
    if (!persona.profesionalId) return { estado: "sin_datos", detalle: "No tiene un profesional asociado." };
    const filas = await dato(ctx, "ingresos", async () => {
      const { data, error } = await cliente.from("ingresos_profesionales").select("profesional_id, turno, hora_programada, estado, hora_llegada, margen_min").eq("fecha", ctx.fecha);
      if (error) throw error;
      return data;
    });
    if (!filas) return { estado: "sin_datos", detalle: "No se pudo comprobar el ingreso." };
    const suyas = filas.filter((x) => x.profesional_id === persona.profesionalId);
    if (suyas.length === 0) return faltaAun(ctx, "Recepción no registró su llegada");
    const partes = [];
    let todoBien = true;
    for (const x of suyas) {
      if (x.estado === "No vino") {
        todoBien = false;
        partes.push(`${x.turno}: figura como «no vino»`);
        continue;
      }
      const antes = aMin(x.hora_programada) - aMin(x.hora_llegada);
      const margen = x.margen_min ?? 15;
      if (antes >= margen) partes.push(`${x.turno}: llegó ${String(x.hora_llegada).slice(0, 5)} (${antes} min antes)`);
      else {
        todoBien = false;
        partes.push(`${x.turno}: llegó ${String(x.hora_llegada).slice(0, 5)} (${antes >= 0 ? `solo ${antes} min antes` : `${-antes} min tarde`})`);
      }
    }
    return { estado: todoBien ? "ok" : "mal", detalle: partes.join(" · ") };
  },

  async que_se_hizo(cliente, ctx, persona) {
    if (!persona.profesionalId) return { estado: "sin_datos", detalle: "No tiene un profesional asociado." };
    const r = await dato(ctx, "cumplimiento", () => calcularCumplimientoRegistro(cliente, { desde: ctx.fecha, hasta: ctx.fecha, hoy: ctx.hoy, ahora: ctx.ahora }));
    if (!r) return { estado: "sin_datos", detalle: "No se pudo comprobar." };
    const mio = r.porProfesional.find((p) => p.id === persona.profesionalId);
    if (!mio) return { estado: "ok", detalle: "No tuvo pacientes para cargar" };
    if (mio.sinCargar === 0) return { estado: "ok", detalle: `Cargó los ${mio.vinieron} paciente${mio.vinieron === 1 ? "" : "s"}` };
    return faltaAun(ctx, `Le faltan cargar ${mio.sinCargar} de ${mio.vinieron} pacientes`);
  },

  async cierre(cliente, ctx, _persona, jornada) {
    const r = await dato(ctx, `cierre-${jornada}`, () => calcularResumenJornada(cliente, { fecha: ctx.fecha, jornada, hoy: ctx.hoy, ahora: ctx.ahora }));
    if (!r) return { estado: "sin_datos", detalle: "No se pudo comprobar." };
    const t = r.total;
    if (t.agendados === 0) return { estado: "ok", detalle: "No hubo turnos en esa jornada" };
    if (t.porVenir > 0) return { estado: "sin_datos", detalle: `Todavía hay ${t.porVenir} turnos por atender` };
    if (t.pacientesPendientes === 0) return { estado: "ok", detalle: `Todo cargado (vinieron ${t.vinieron} de ${t.agendados})` };
    const quienes = r.porProfesional.filter((p) => p.pacientes.length > 0).map((p) => `${String(p.nombre).split(" ")[0]} ${p.pacientes.length}`);
    return faltaAun(ctx, `Sin cargar ${t.pacientesPendientes}: ${quienes.join(" · ")}`);
  },
  cierre_manana: (cliente, ctx, persona) => COMPROBACIONES.cierre(cliente, ctx, persona, "manana"),
  cierre_tarde: (cliente, ctx, persona) => COMPROBACIONES.cierre(cliente, ctx, persona, "tarde"),

  async consentimientos_manana(cliente, ctx) {
    const sig = proximoDiaDeTrabajo(ctx.fecha);
    const filas = await dato(ctx, "consentimientos", async () => {
      const { data, error } = await cliente
        .from("turnos_general")
        .select("paciente_id, paciente:pacientes(apellido_y_nombre, consentimientos_firmados)")
        .eq("fecha", sig)
        .eq("estado", "Agendado")
        .not("paciente_id", "is", null);
      if (error) throw error;
      return data;
    });
    if (!filas) return { estado: "sin_datos", detalle: "No se pudo comprobar." };
    if (filas.length === 0) return { estado: "ok", detalle: `No hay turnos de General el ${textoDeFecha(sig)}` };
    const faltan = [...new Set(filas.filter((f) => f.paciente && !f.paciente.consentimientos_firmados).map((f) => f.paciente.apellido_y_nombre?.trim()))];
    if (faltan.length === 0) return { estado: "ok", detalle: `Los ${filas.length} turnos del ${textoDeFecha(sig)} tienen consentimiento` };
    return faltaAun(ctx, `Sin consentimiento (${textoDeFecha(sig)}): ${lista(faltan)}`);
  },

  async fotos_panoramicas(cliente, ctx, persona) {
    const filas = await dato(ctx, "panoramicas", async () => {
      // El día argentino empieza a las 03:00 UTC.
      const { data, error } = await cliente.from("panoramicas").select("subido_por").gte("created_at", `${ctx.fecha}T03:00:00Z`).lt("created_at", `${sumarDiasISO(ctx.fecha, 1)}T03:00:00Z`);
      if (error) throw error;
      return data;
    });
    if (!filas) return { estado: "sin_datos", detalle: "No se pudo comprobar." };
    const n = filas.filter((f) => f.subido_por === persona.usuarioId).length;
    return n > 0 ? { estado: "ok", detalle: `Subió ${n} archivo${n === 1 ? "" : "s"} en Pano y fotos` } : faltaAun(ctx, "No subió nada en Pano y fotos");
  },
};

// ---- Cálculo de la rutina de un día ----
// Devuelve { fecha, personas: [{ usuarioId, nombre, rol, hoja: { id, nombre, corte, orden }, tareas: [...], hechas, total, porcentaje, conActividad }] }.
// Con `usuarioId` calcula solo esa persona (para su propia pantalla).
export async function calcularRutinaDelDia(cliente, { fecha, hoy, ahora, usuarioId = null }) {
  const ctx = { fecha, hoy, ahora, cache: new Map() };

  let consultaAsig = cliente.from("rutina_equipo_asignaciones").select("usuario_id, hoja_id");
  if (usuarioId) consultaAsig = consultaAsig.eq("usuario_id", usuarioId);
  const [hojasRes, tareasRes, asigRes, tildesRes] = await Promise.all([
    cliente.from("rutina_equipo_hojas").select("id, nombre, orden, corte, activa").eq("activa", true),
    cliente.from("rutina_equipo_tareas").select("id, hoja_id, momento, orden, texto, verificacion, pide_valor").eq("activa", true).order("orden"),
    consultaAsig,
    (usuarioId ? cliente.from("rutina_equipo_tildes").select("id, tarea_id, usuario_id, hecho_en, valor, visto_por, visto_en").eq("fecha", fecha).eq("usuario_id", usuarioId) : cliente.from("rutina_equipo_tildes").select("id, tarea_id, usuario_id, hecho_en, valor, visto_por, visto_en").eq("fecha", fecha)),
  ]);
  for (const r of [hojasRes, tareasRes, asigRes, tildesRes]) {
    if (r.error) {
      if (/relation|does not exist|schema cache/i.test(r.error.message || "")) throw new Error("Falta correr la migración 207 en Supabase.");
      throw r.error;
    }
  }
  const asignaciones = asigRes.data;
  if (asignaciones.length === 0) return { fecha, personas: [] };

  const { data: perfiles, error: errorPerfiles } = await cliente.from("perfiles").select("id, nombre, rol, profesional_id").in("id", asignaciones.map((a) => a.usuario_id));
  if (errorPerfiles) throw errorPerfiles;
  const hojas = new Map(hojasRes.data.map((h) => [h.id, h]));
  const tareasPorHoja = new Map();
  for (const t of tareasRes.data) (tareasPorHoja.get(t.hoja_id) || tareasPorHoja.set(t.hoja_id, []).get(t.hoja_id)).push(t);

  const personas = [];
  for (const a of asignaciones) {
    const hoja = hojas.get(a.hoja_id);
    const perfil = perfiles.find((p) => p.id === a.usuario_id);
    if (!hoja || !perfil) continue;
    const persona = { usuarioId: perfil.id, profesionalId: perfil.profesional_id || null };
    const tareas = [];
    for (const t of tareasPorHoja.get(hoja.id) || []) {
      const tilde = tildesRes.data.find((x) => x.tarea_id === t.id && x.usuario_id === perfil.id) || null;
      let sistema = null;
      if (t.verificacion && COMPROBACIONES[t.verificacion]) {
        try {
          sistema = await COMPROBACIONES[t.verificacion](cliente, ctx, persona);
        } catch {
          sistema = { estado: "sin_datos", detalle: "No se pudo comprobar." };
        }
      }
      const umbral = umbralDeValor(t.pide_valor);
      const numero = tilde?.valor !== null && tilde?.valor !== undefined ? Number(String(tilde.valor).replace(",", ".")) : null;
      let estado;
      if (sistema?.estado === "ok") estado = "verificada";
      else if (tilde && sistema?.estado === "mal") estado = "contradice";
      else if (tilde && umbral !== null && !(numero >= umbral)) estado = "insuficiente";
      else if (tilde) estado = "declarada";
      else if (sistema?.estado === "mal") estado = "mal";
      else estado = "pendiente";
      tareas.push({
        id: t.id,
        momento: t.momento,
        orden: t.orden,
        texto: t.texto,
        verificacion: t.verificacion,
        pideValor: t.pide_valor,
        umbral,
        tilde: tilde ? { id: tilde.id, hechoEn: tilde.hecho_en, valor: tilde.valor, vistoPor: tilde.visto_por, vistoEn: tilde.visto_en } : null,
        sistema,
        estado,
      });
    }
    const hechas = tareas.filter((t) => ESTADOS[t.estado].hecha).length;
    // "Con actividad": tildó algo, o el sistema vio que vino a trabajar (marcó su horario, Recepción registró su llegada, cargó pacientes
    // o subió archivos).
    const conActividad = tareas.some((t) => t.tilde || /^(Marcó su entrada|Cargó los|Subió|[^:]+: llegó \d)/.test(t.sistema?.detalle || ""));
    // Un profesional sin ninguna actividad y sin turnos ese día simplemente no trabaja: no se le cuenta.
    let libre = false;
    if (!conActividad && persona.profesionalId) {
      const conTurnos = await dato(ctx, "profesionalesConTurnos", async () => {
        const [g, o] = await Promise.all([
          cliente.from("turnos_general").select("profesional_de_turno_id").eq("fecha", fecha).eq("estado", "Agendado"),
          cliente.from("turnos_ortodoncia").select("ortodoncista_id").eq("fecha", fecha).eq("estado", "Agendado"),
        ]);
        if (g.error || o.error) throw g.error || o.error;
        return new Set([...g.data.map((x) => x.profesional_de_turno_id), ...o.data.map((x) => x.ortodoncista_id)]);
      });
      libre = Boolean(conTurnos) && !conTurnos.has(persona.profesionalId);
    }
    personas.push({
      libre,
      usuarioId: perfil.id,
      nombre: perfil.nombre,
      rol: perfil.rol,
      hoja: { id: hoja.id, nombre: hoja.nombre, corte: hoja.corte, orden: hoja.orden },
      tareas,
      hechas,
      total: tareas.length,
      porcentaje: tareas.length ? Math.round((hechas / tareas.length) * 100) : 100,
      conActividad,
    });
  }
  personas.sort((a, b) => a.hoja.orden - b.hoja.orden || a.nombre.localeCompare(b.nombre));
  return { fecha, personas };
}

// Agrupa las tareas de una persona por momento, conservando el orden.
export function tareasPorMomento(tareas) {
  const grupos = [];
  for (const t of tareas) {
    let g = grupos.find((x) => x.momento === t.momento);
    if (!g) grupos.push((g = { momento: t.momento, tareas: [] }));
    g.tareas.push(t);
  }
  return grupos;
}

// "1. Al llegar" → "Al llegar" (el número solo sirve para ordenar).
export const nombreDeMomento = (m) => String(m || "").replace(/^\d+\.\s*/, "");

// Texto corto para el aviso del celular de las Dueñas: cómo viene la rutina de las hojas que se evalúan a ese corte ('manana' | 'tarde').
export function textoAvisoRutina(rutina, corte) {
  const personas = rutina.personas.filter((p) => p.hoja.corte === corte && !p.libre);
  if (personas.length === 0) return null;
  const lineas = [];
  let completas = 0;
  for (const p of personas) {
    const primerNombre = String(p.nombre).split(" ")[0];
    const faltan = p.tareas.filter((t) => !ESTADOS[t.estado].hecha);
    if (!p.conActividad) lineas.push(`${primerNombre}: sin actividad hoy`);
    else if (faltan.length === 0) completas += 1;
    else {
      // Con pocas tareas pendientes se nombran (cortadas sin romper palabras); con muchas, solo la cantidad.
      const corta = (t) => (t.length > 42 ? `${t.slice(0, 42).replace(/\s+\S*$/, "")}…` : t);
      lineas.push(`${primerNombre}: ${p.hechas}/${p.total}${faltan.length <= 2 ? ` · falta: ${faltan.map((t) => corta(t.texto)).join(" / ")}` : ` · faltan ${faltan.length}`}`);
    }
  }
  const cab = completas === personas.length ? "✅ Todos completaron su rutina" : `${completas} de ${personas.length} completaron su rutina`;
  return { titulo: `✅ Rutina del equipo · ${corte === "manana" ? "mañana" : "tarde"}`, mensaje: [cab, ...lineas].join("\n") };
}
