// Seguimiento de pacientes de Odontología General: arma sola la lista de pacientes que vinieron a la consulta (o empezaron el tratamiento)
// y hoy no tienen un próximo turno, para escribirles. Recibe el cliente de Supabase, así corre en el navegador y en el servidor.
//
// Categorías:
//   A · "Presupuesto sin aceptar":  tiene un presupuesto Pendiente y todavía no se le hizo ningún tratamiento.
//   C · "Tratamiento en pausa":     ya se le hizo algo además de la consulta (o aceptó un presupuesto) y no tiene próximo turno.
//   B · "Solo vino a la consulta":  hizo la consulta, no tiene presupuesto y no volvió.
// Quedan afuera: los que ya tienen un turno por venir, los de alta, los que vinieron hace menos de 3 días, los que no siguen (marcado
// a mano en el seguimiento) y los que no están activos.

export const CATEGORIAS = {
  A: { clave: "A", titulo: "Presupuesto sin aceptar", corto: "Presupuesto" },
  C: { clave: "C", titulo: "Tratamiento en pausa", corto: "En pausa" },
  B: { clave: "B", titulo: "Solo vino a la consulta", corto: "Solo consulta" },
};
export const DIAS_RECIEN_ATENDIDO = 3;
const ESTADOS_DESCARTADO = ["No quiere seguir", "Ya no es paciente"];

async function leerTodo(consulta, pagina = 1000) {
  const filas = [];
  for (let d = 0; ; d += pagina) {
    const { data, error } = await consulta().range(d, d + pagina - 1);
    if (error) throw error;
    filas.push(...data);
    if (data.length < pagina) break;
  }
  return filas;
}

async function enLotes(ids, consultaPorLote) {
  const filas = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await consultaPorLote(ids.slice(i, i + 100));
    if (error) throw error;
    filas.push(...data);
  }
  return filas;
}

const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
const esConsulta = (t) => /consulta/i.test(t || "");

//   devuelve { disponible, lista: [{ pacienteId, nombre, celular, celularDeTurno, categoria, profesionalId, profesional, ultimaVisita, dias,
//              primeraConsulta, presupuestos: [{ numero, fecha, total, items }], totalPresupuesto, proxima, ultimaPractica, gestion }],
//              resumen: { porContactar, contactados, conTurnoDespues, descartados, montoPendiente } }
export async function calcularSeguimientoGeneral(cliente, { hoy }) {
  const gestionRes = await cliente.from("seguimiento_general").select("paciente_id, estado, nota, fecha_ultimo_contacto");
  const disponible = !gestionRes.error;
  const gestion = new Map((gestionRes.data || []).map((g) => [g.paciente_id, g]));

  const [registros, pendientes, aceptados] = await Promise.all([
    leerTodo(() =>
      cliente
        .from("prestaciones_realizadas_agenda")
        .select("paciente_id, fecha, prestacion, profesional_id, proxima_prestacion_nombre, nota_proximo_turno, alta, created_at")
        .not("turno_general_id", "is", null)
        .not("paciente_id", "is", null)
        .order("fecha")
        .order("created_at")
    ),
    leerTodo(() => cliente.from("presupuestos").select("id, numero, fecha, paciente_id, total, prestaciones, profesional_id").eq("estado", "Pendiente").order("fecha")),
    leerTodo(() => cliente.from("presupuestos").select("paciente_id").eq("estado", "Aceptado")),
  ]);

  const ids = [...new Set([...registros.map((r) => r.paciente_id), ...pendientes.map((p) => p.paciente_id)])];
  if (ids.length === 0) return { disponible, lista: [], resumen: { porContactar: 0, contactados: 0, conTurnoDespues: 0, descartados: 0, montoPendiente: 0 } };

  const desde = new Date(new Date(`${hoy}T12:00:00Z`).getTime() - 200 * 86400000).toISOString().slice(0, 10);
  const [pacientes, turnos, profesionales] = await Promise.all([
    enLotes(ids, (lote) => cliente.from("pacientes").select("id, apellido_y_nombre, celular, estado").in("id", lote)),
    enLotes(ids, (lote) => cliente.from("turnos_general").select("paciente_id, fecha, estado, asistencia, celular, profesional_de_turno_id").in("paciente_id", lote).gte("fecha", desde).eq("estado", "Agendado")),
    cliente.from("profesionales").select("id, nombre").then((r) => r.data || []),
  ]);
  const nombreProf = new Map(profesionales.map((p) => [p.id, p.nombre]));
  const aceptadosSet = new Set(aceptados.map((a) => a.paciente_id));

  const lista = [];
  let conTurnoDespues = 0;
  let contactados = 0;
  let descartados = 0;
  for (const p of pacientes) {
    if (p.estado && p.estado !== "Activo") continue;
    const g = gestion.get(p.id) || null;
    const regs = registros.filter((r) => r.paciente_id === p.id);
    const pend = pendientes.filter((x) => x.paciente_id === p.id);
    const misTurnos = turnos.filter((t) => t.paciente_id === p.id);
    const futuros = misTurnos.filter((t) => t.fecha >= hoy);
    const pasados = misTurnos.filter((t) => t.fecha < hoy && t.asistencia !== "No asistió");

    const ultimoReg = regs[regs.length - 1] || null;
    const fechas = [...regs.map((r) => r.fecha), ...pasados.map((t) => t.fecha)].filter((f) => f <= hoy);
    const ultimaVisita = fechas.length ? fechas.reduce((a, b) => (a > b ? a : b)) : null;

    // Resultado de los contactos: ¿ya tiene turno desde que se le escribió?
    const fueContactado = g && ["Mensaje enviado", "Sin respuesta", "Quiere seguir", "Turno agendado"].includes(g.estado);
    if (fueContactado) {
      contactados += 1;
      if (futuros.length || (g.fecha_ultimo_contacto && misTurnos.some((t) => t.fecha >= g.fecha_ultimo_contacto))) conTurnoDespues += 1;
    }
    if (g && ESTADOS_DESCARTADO.includes(g.estado)) {
      descartados += 1;
      continue;
    }
    if (futuros.length) continue; // ya tiene turno por venir
    if (ultimoReg?.alta) continue; // de alta
    if (ultimaVisita && diasEntre(ultimaVisita, hoy) < DIAS_RECIEN_ATENDIDO) continue; // recién atendido

    const tratamientos = regs.filter((r) => !esConsulta(r.prestacion));
    const consultas = regs.filter((r) => esConsulta(r.prestacion));
    const enTratamiento = tratamientos.length > 0 || aceptadosSet.has(p.id);
    // "Tratamiento en pausa" solo si quedó algo por hacer: lo último que se cargó indica qué sigue, o tiene un presupuesto pendiente o aceptado.
    // Quien terminó lo que tenía que hacerse (y no quedó nada indicado) no se le insiste.
    const quedaAlgo = Boolean(ultimoReg?.proxima_prestacion_nombre || ultimoReg?.nota_proximo_turno) || pend.length > 0 || aceptadosSet.has(p.id);
    let categoria = null;
    if (enTratamiento) categoria = quedaAlgo ? "C" : null;
    else if (pend.length) categoria = "A";
    else if (consultas.length) categoria = "B";
    if (!categoria) continue;

    const celularTurno = [...misTurnos].reverse().find((t) => t.celular)?.celular || "";
    const profId = ultimoReg?.profesional_id || misTurnos[misTurnos.length - 1]?.profesional_de_turno_id || null;
    const conProxima = [...regs].reverse().find((r) => r.proxima_prestacion_nombre);
    lista.push({
      pacienteId: p.id,
      nombre: p.apellido_y_nombre?.trim() || "(sin nombre)",
      celular: p.celular || celularTurno || "",
      celularDeTurno: !p.celular && Boolean(celularTurno),
      categoria,
      profesionalId: profId,
      profesional: profId ? nombreProf.get(profId) || null : null,
      ultimaVisita,
      dias: ultimaVisita ? diasEntre(ultimaVisita, hoy) : null,
      primeraConsulta: consultas[0]?.fecha || null,
      presupuestos: pend.map((x) => ({ numero: x.numero, fecha: x.fecha, total: Number(x.total || 0), items: (x.prestaciones || []).map((i) => i.prestacion).filter(Boolean) })),
      totalPresupuesto: pend.reduce((a, x) => a + Number(x.total || 0), 0),
      proxima: conProxima?.proxima_prestacion_nombre || null,
      ultimaPractica: tratamientos[tratamientos.length - 1]?.prestacion || null,
      gestion: g,
    });
  }

  // Orden: primero los que hay que contactar; dentro, presupuestos de más plata y luego los que hace más que no vienen.
  const peso = { A: 0, C: 1, B: 2 };
  lista.sort(
    (a, b) =>
      Number(Boolean(a.gestion && a.gestion.estado !== "Por contactar")) - Number(Boolean(b.gestion && b.gestion.estado !== "Por contactar")) ||
      peso[a.categoria] - peso[b.categoria] ||
      b.totalPresupuesto - a.totalPresupuesto ||
      (b.dias ?? 0) - (a.dias ?? 0)
  );
  const porContactar = lista.filter((x) => !x.gestion || x.gestion.estado === "Por contactar").length;
  const montoPendiente = lista.filter((x) => x.totalPresupuesto > 0).reduce((a, x) => a + x.totalPresupuesto, 0);
  return { disponible, lista, resumen: { porContactar, contactados, conTurnoDespues, descartados, montoPendiente } };
}
