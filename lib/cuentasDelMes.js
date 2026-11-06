// Cuánto hay que pagar este mes para cubrir las cuentas: sueldos del personal (horas del mes anterior × valor hora) y gastos
// fijos de "Gastos de la Clínica" (con el último monto que se pagó), contra lo que hay en la reserva de Consultorio.
// Sirve igual desde el navegador y desde el servidor (el aviso mensual): recibe el cliente de Supabase que corresponda.

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const nombreDeMes = (mes) => MESES[mes - 1];

const pad = (n) => String(n).padStart(2, "0");
const sinAcentos = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function horasDe(entrada, salida) {
  if (!entrada || !salida) return 0;
  const [he, me] = entrada.slice(0, 5).split(":").map(Number);
  const [hs, ms] = salida.slice(0, 5).split(":").map(Number);
  const minutos = hs * 60 + ms - (he * 60 + me);
  return minutos > 0 ? minutos / 60 : 0;
}

function rangoDeMes(anio, mes) {
  return { inicio: `${anio}-${pad(mes)}-01`, fin: `${anio}-${pad(mes)}-${pad(new Date(anio, mes, 0).getDate())}` };
}

// mesHoras: "anterior" (lo normal: se paga a principio de mes lo trabajado el mes pasado) o "actual".
export async function calcularCuentasDelMes(cliente, hoyISO, { mesHoras = "anterior" } = {}) {
  const [anio, mes] = hoyISO.split("-").map(Number);
  const horas = mesHoras === "actual" ? { anio, mes } : mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
  const rangoHoras = rangoDeMes(horas.anio, horas.mes);
  const inicioMes = `${anio}-${pad(mes)}-01`;

  const [perfiles, registros, recurrentes, gastosDelMes, movimientos] = await Promise.all([
    cliente.from("perfiles").select("id, nombre, rol, valor_hora").not("valor_hora", "is", null),
    cliente.from("registros_horario").select("usuario_id, hora_entrada, hora_salida").gte("fecha", rangoHoras.inicio).lte("fecha", rangoHoras.fin),
    cliente.from("gastos_recurrentes").select("nombre, categoria, tipo, monto_sugerido").eq("activo", true).order("orden").order("nombre"),
    cliente.from("gastos").select("descripcion, categoria, monto, fecha").gte("fecha", inicioMes).lte("fecha", hoyISO),
    cliente.from("movimientos_personales").select("cuenta, tipo, monto").eq("panel", "Consultorio"),
  ]);
  for (const r of [perfiles, registros, recurrentes, gastosDelMes, movimientos]) if (r.error) throw r.error;

  const horasPorUsuario = {};
  for (const r of registros.data) horasPorUsuario[r.usuario_id] = (horasPorUsuario[r.usuario_id] || 0) + horasDe(r.hora_entrada, r.hora_salida);

  // Un sueldo se da por pagado si este mes ya hay un gasto de "Sueldos" que nombra a la persona.
  const sueldosPagados = gastosDelMes.data.filter((g) => g.categoria === "Sueldos");
  const sueldos = perfiles.data
    .map((p) => {
      const h = horasPorUsuario[p.id] || 0;
      const primerNombre = sinAcentos(p.nombre).split(/\s+/)[0];
      const pago = sueldosPagados.find((g) => primerNombre.length >= 3 && sinAcentos(g.descripcion).includes(primerNombre));
      return {
        clave: `sueldo:${p.id}`,
        tipo: "sueldo",
        nombre: p.nombre,
        concepto: `Sueldo ${p.nombre} — ${nombreDeMes(horas.mes)}`,
        categoria: "Sueldos",
        horas: Math.round(h * 100) / 100,
        valorHora: Number(p.valor_hora),
        monto: Math.round(h * Number(p.valor_hora)),
        pagado: Boolean(pago),
        pagadoMonto: pago ? Number(pago.monto) : null,
        pagadoFecha: pago?.fecha || null,
      };
    })
    .filter((s) => s.horas > 0)
    .sort((a, b) => b.monto - a.monto);

  const nombresPagados = new Map(gastosDelMes.data.map((g) => [sinAcentos(g.descripcion), g]));
  const fijos = recurrentes.data
    .filter((r) => Number(r.monto_sugerido) > 0)
    .map((r) => {
      const pago = nombresPagados.get(sinAcentos(r.nombre));
      return {
        clave: `fijo:${r.nombre}`,
        tipo: "fijo",
        nombre: r.nombre,
        concepto: r.nombre,
        categoria: r.categoria,
        monto: Number(r.monto_sugerido),
        pagado: Boolean(pago),
        pagadoMonto: pago ? Number(pago.monto) : null,
        pagadoFecha: pago?.fecha || null,
      };
    });

  const reserva = { Banco: 0, Efectivo: 0 };
  for (const m of movimientos.data) reserva[m.cuenta] += (m.tipo === "Ingreso" ? 1 : -1) * Number(m.monto);
  reserva.total = reserva.Banco + reserva.Efectivo;

  const suma = (lista, soloFalta) => lista.filter((x) => !soloFalta || !x.pagado).reduce((a, x) => a + x.monto, 0);
  const falta = suma(sueldos, true) + suma(fijos, true);
  return {
    mesHoras: horas,
    mesActual: { anio, mes },
    sueldos,
    fijos,
    totalSueldos: suma(sueldos, false),
    totalFijos: suma(fijos, false),
    faltaSueldos: suma(sueldos, true),
    faltaFijos: suma(fijos, true),
    falta,
    reserva,
    diferencia: reserva.total - falta,
  };
}
