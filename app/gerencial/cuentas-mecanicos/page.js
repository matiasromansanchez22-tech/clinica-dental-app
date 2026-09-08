"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import GastoFormModal from "@/components/GastoFormModal";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerFechasEnvioPorTrabajo, obtenerTrabajosLaboratorio } from "@/lib/data/laboratorio";
import { obtenerCategoriasGasto, obtenerPagosALaboratorio } from "@/lib/data/gastos";
import { obtenerNombresLaboratoriosMecanicos } from "@/lib/data/mecanicosPrecios";

const CATEGORIA_PAGO_LABORATORIO = "Pagos a Laboratorio";

function primerYUltimoDiaDelMes(fechaISO) {
  const [anio, mes] = fechaISO.split("-").map(Number);
  const primero = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const ultimo = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { primero, ultimo };
}

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function nombreDelMes(claveMes) {
  const [anio, mes] = claveMes.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, 1);
  const texto = fecha.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Lo que "cobramos" por un trabajo es el valor de catálogo (efectivo si lo
// tiene, si no el de lista) de la prestación vinculada. Solo se puede
// calcular si el trabajo quedó vinculado a una prestación del catálogo —
// eso pasa solo cuando el "Tipo de trabajo" escrito coincide con el
// nombre exacto de una prestación.
function cobradoDe(t) {
  if (!t.catalogo) return null;
  return t.catalogo.valorEfectivo || t.catalogo.valorLista || 0;
}

function margenDe(t) {
  const cobrado = cobradoDe(t);
  if (cobrado === null || !t.valor) return null;
  return cobrado - Number(t.valor);
}

function CuentasMecanicosContenido() {
  const hoy = fechaDeHoyISO();
  const { primero, ultimo } = primerYUltimoDiaDelMes(hoy);
  const [fechaInicio, setFechaInicio] = useState(primero);
  const [fechaFin, setFechaFin] = useState(ultimo);
  const [trabajos, setTrabajos] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [categoriasGasto, setCategoriasGasto] = useState([]);
  const [laboratoriosSugeridos, setLaboratoriosSugeridos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [cuentaExpandida, setCuentaExpandida] = useState(null);
  const [modalPago, setModalPago] = useState(null); // nombre del mecánico, o null

  async function recargarCuentaCorriente() {
    setPagos(await obtenerPagosALaboratorio());
  }

  useEffect(() => {
    setCargando(true);
    Promise.all([
      obtenerTrabajosLaboratorio(),
      obtenerFechasEnvioPorTrabajo(),
      obtenerPagosALaboratorio(),
      obtenerCategoriasGasto(),
      obtenerNombresLaboratoriosMecanicos(),
    ])
      .then(([lista, fechasEnvio, pagosLab, cats, labs]) => {
        // Solo entran acá los trabajos que ya se marcaron como enviados —
        // mientras están "Pendiente de envío" no hay nada que cotejar
        // todavía contra ninguna factura.
        setTrabajos(
          lista
            .filter((t) => fechasEnvio[t.id])
            .map((t) => ({ ...t, fechaEnvio: fechasEnvio[t.id] }))
        );
        setPagos(pagosLab);
        setCategoriasGasto(cats);
        setLaboratoriosSugeridos(labs);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  // Cuenta corriente por mecánico: cuánto le debemos en total (todos los
  // trabajos ya enviados, de siempre) contra cuánto ya le pagamos (gastos
  // "Pagos a Laboratorio" con ese mecánico) — no depende del filtro de
  // fechas de arriba, es un saldo acumulado.
  const cuentaCorriente = useMemo(() => {
    const mapa = {};
    for (const t of trabajos) {
      const nombre = t.laboratorio || "Sin asignar";
      if (!mapa[nombre]) mapa[nombre] = { nombre, debe: 0, pagado: 0, pagos: [] };
      if (t.valor) mapa[nombre].debe += Number(t.valor);
    }
    for (const p of pagos) {
      const nombre = p.mecanico || "Sin especificar";
      if (!mapa[nombre]) mapa[nombre] = { nombre, debe: 0, pagado: 0, pagos: [] };
      mapa[nombre].pagado += Number(p.monto);
      mapa[nombre].pagos.push(p);
    }
    return Object.values(mapa)
      .map((c) => ({ ...c, saldo: c.debe - c.pagado }))
      .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
  }, [trabajos, pagos]);

  function irAEsteMes() {
    setFechaInicio(primero);
    setFechaFin(ultimo);
  }

  const trabajosDelPeriodo = useMemo(
    () => trabajos.filter((t) => t.fechaEnvio >= fechaInicio && t.fechaEnvio <= fechaFin),
    [trabajos, fechaInicio, fechaFin]
  );

  const porLaboratorio = useMemo(() => {
    const mapa = {};
    for (const t of trabajosDelPeriodo) {
      const nombre = t.laboratorio || "Sin asignar";
      if (!mapa[nombre]) mapa[nombre] = { nombre, total: 0, cantidadSinValor: 0, trabajos: [] };
      mapa[nombre].trabajos.push(t);
      if (t.valor) mapa[nombre].total += Number(t.valor);
      else mapa[nombre].cantidadSinValor += 1;
    }
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [trabajosDelPeriodo]);

  const totalGeneral = porLaboratorio.reduce((acc, l) => acc + l.total, 0);
  const totalSinValor = porLaboratorio.reduce((acc, l) => acc + l.cantidadSinValor, 0);

  // Margen del período: solo sobre los trabajos que quedaron vinculados al
  // catálogo (tienen de dónde sacar "cuánto cobramos").
  const trabajosVinculados = trabajosDelPeriodo.filter((t) => cobradoDe(t) !== null && t.valor);
  const totalCobradoVinculados = trabajosVinculados.reduce((a, t) => a + cobradoDe(t), 0);
  const totalPagadoVinculados = trabajosVinculados.reduce((a, t) => a + Number(t.valor), 0);
  const margenTotal = totalCobradoVinculados - totalPagadoVinculados;
  const porcentajeMargen = totalCobradoVinculados > 0 ? (margenTotal / totalCobradoVinculados) * 100 : 0;
  const cantidadSinVincular = trabajosDelPeriodo.filter((t) => t.valor && cobradoDe(t) === null).length;

  // Margen promedio por tipo de trabajo, para ver dónde conviene ajustar precios.
  const margenPorTipo = useMemo(() => {
    const mapa = {};
    for (const t of trabajosVinculados) {
      const clave = t.tipoTrabajo;
      if (!mapa[clave]) mapa[clave] = { tipoTrabajo: clave, cantidad: 0, totalCobrado: 0, totalPagado: 0 };
      mapa[clave].cantidad++;
      mapa[clave].totalCobrado += cobradoDe(t);
      mapa[clave].totalPagado += Number(t.valor);
    }
    return Object.values(mapa)
      .map((m) => ({
        ...m,
        margen: m.totalCobrado - m.totalPagado,
        porcentaje: m.totalCobrado > 0 ? ((m.totalCobrado - m.totalPagado) / m.totalCobrado) * 100 : 0,
      }))
      .sort((a, b) => a.porcentaje - b.porcentaje);
  }, [trabajosVinculados]);

  // Tendencia de los últimos 6 meses con datos, para ver si lo que se le
  // paga al mecánico viene subiendo (sobre TODOS los trabajos enviados,
  // sin importar el filtro de fecha de arriba).
  const tendenciaMensual = useMemo(() => {
    const porMes = {};
    for (const t of trabajos) {
      if (!t.fechaEnvio) continue;
      const mes = t.fechaEnvio.slice(0, 7);
      if (!porMes[mes]) {
        porMes[mes] = { mes, cantidad: 0, totalPagado: 0, totalPagadoVinculados: 0, totalCobrado: 0, cantidadVinculada: 0 };
      }
      porMes[mes].cantidad++;
      if (t.valor) porMes[mes].totalPagado += Number(t.valor);
      const cobrado = cobradoDe(t);
      if (cobrado !== null && t.valor) {
        porMes[mes].totalCobrado += cobrado;
        porMes[mes].totalPagadoVinculados += Number(t.valor);
        porMes[mes].cantidadVinculada++;
      }
    }
    return Object.values(porMes)
      .sort((a, b) => b.mes.localeCompare(a.mes))
      .slice(0, 6);
  }, [trabajos]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Cuentas por mecánico</h1>
      <p className="mt-1 text-sm text-gray-500">
        Qué se le envió a cada mecánico en el período, cuánto suma, y cuánto nos queda de margen sobre lo que
        cobramos por cada trabajo.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <h2 className="mt-6 mb-1 font-heading text-sm font-semibold text-brand-brown">Cuenta corriente (acumulado de siempre)</h2>
      <p className="mb-2 text-xs text-gray-500">
        Lo que le debemos a cada mecánico por todos los trabajos enviados, contra lo que ya le pagamos. Si el saldo
        es negativo, quedó a favor nuestro (le pagamos de más).
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Mecánico</th>
              <th className="px-3 py-2 text-right font-semibold">Debemos (trabajos)</th>
              <th className="px-3 py-2 text-right font-semibold">Ya pagamos</th>
              <th className="px-3 py-2 text-right font-semibold">Saldo</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && cuentaCorriente.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                  Todavía no hay trabajos ni pagos cargados.
                </td>
              </tr>
            )}
            {cuentaCorriente.map((c) => (
              <Fragment key={c.nombre}>
                <tr
                  onClick={() => setCuentaExpandida((e) => (e === c.nombre ? null : c.nombre))}
                  className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {cuentaExpandida === c.nombre ? "▾" : "▸"} {c.nombre}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">{formatoPesos(c.debe)}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{formatoPesos(c.pagado)}</td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${
                      c.saldo > 0 ? "text-amber-700" : c.saldo < 0 ? "text-emerald-700" : "text-gray-500"
                    }`}
                  >
                    {c.saldo > 0
                      ? `Le debemos ${formatoPesos(c.saldo)}`
                      : c.saldo < 0
                        ? `A favor nuestro ${formatoPesos(-c.saldo)}`
                        : "Al día"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalPago(c.nombre);
                      }}
                      className="rounded-md border border-brand-brown/40 px-2 py-1 text-xs font-medium text-brand-brown hover:bg-brand-tan/30"
                    >
                      + Registrar pago
                    </button>
                  </td>
                </tr>
                {cuentaExpandida === c.nombre && (
                  <tr className="bg-gray-50">
                    <td colSpan={5} className="px-3 py-2">
                      {c.pagos.length === 0 ? (
                        <p className="px-2 py-1 text-xs text-gray-400">Todavía no hay pagos registrados a este mecánico.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="px-2 py-1 text-left font-medium">Fecha</th>
                              <th className="px-2 py-1 text-left font-medium">Descripción</th>
                              <th className="px-2 py-1 text-right font-medium">Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.pagos
                              .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
                              .map((p) => (
                                <tr key={p.id} className="border-t border-gray-200">
                                  <td className="px-2 py-1">{p.fecha}</td>
                                  <td className="px-2 py-1">
                                    {p.descripcion || "—"}
                                    {p.observaciones && <span className="text-gray-400"> — {p.observaciones}</span>}
                                  </td>
                                  <td className="px-2 py-1 text-right">{formatoPesos(p.monto)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 mb-2 font-heading text-sm font-semibold text-brand-brown">Detalle del período</h2>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={irAEsteMes} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          Este mes
        </button>
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <span className="text-sm text-gray-500">a</span>
        <input
          type="date"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <div className="rounded-md border border-gray-200 px-3 py-2 text-sm">
          <span className="text-gray-500">Trabajos enviados: </span>
          <span className="font-semibold text-gray-900">{trabajosDelPeriodo.length}</span>
        </div>
        <div className="rounded-md bg-brand-brown px-3 py-2 text-sm text-white">
          Pagado a mecánicos: <span className="font-semibold">{formatoPesos(totalGeneral)}</span>
        </div>
        {totalSinValor > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ⚠️ {totalSinValor} trabajo{totalSinValor === 1 ? "" : "s"} sin valor cargado (no {totalSinValor === 1 ? "está" : "están"}{" "}
            en el total)
          </div>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="font-heading text-sm font-semibold text-emerald-800">💰 Margen del período</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <div className="rounded-md bg-white px-3 py-2 text-sm shadow-sm">
            <span className="text-gray-500">Cobramos (catálogo): </span>
            <span className="font-semibold text-gray-900">{formatoPesos(totalCobradoVinculados)}</span>
          </div>
          <div className="rounded-md bg-white px-3 py-2 text-sm shadow-sm">
            <span className="text-gray-500">Pagamos al mecánico: </span>
            <span className="font-semibold text-gray-900">{formatoPesos(totalPagadoVinculados)}</span>
          </div>
          <div className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white">
            Nos queda: <span className="font-semibold">{formatoPesos(margenTotal)}</span> (
            {porcentajeMargen.toFixed(0)}%)
          </div>
        </div>
        {cantidadSinVincular > 0 && (
          <p className="mt-2 text-xs text-emerald-700">
            {cantidadSinVincular} trabajo{cantidadSinVincular === 1 ? "" : "s"} con valor cargado pero sin vincular a
            una prestación del catálogo — no {cantidadSinVincular === 1 ? "entra" : "entran"} en esta cuenta.
            Se vincula solo cuando el "Tipo de trabajo" coincide exactamente con el nombre de una prestación.
          </p>
        )}

        {margenPorTipo.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-emerald-800">
                  <th className="px-2 py-1 text-left font-medium">Tipo de trabajo</th>
                  <th className="px-2 py-1 text-center font-medium">Cantidad</th>
                  <th className="px-2 py-1 text-right font-medium">Cobramos</th>
                  <th className="px-2 py-1 text-right font-medium">Pagamos</th>
                  <th className="px-2 py-1 text-right font-medium">Margen</th>
                  <th className="px-2 py-1 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {margenPorTipo.map((m) => (
                  <tr key={m.tipoTrabajo} className="border-t border-emerald-100">
                    <td className="px-2 py-1.5 text-gray-800">{m.tipoTrabajo}</td>
                    <td className="px-2 py-1.5 text-center text-gray-600">{m.cantidad}</td>
                    <td className="px-2 py-1.5 text-right text-gray-600">{formatoPesos(m.totalCobrado)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-600">{formatoPesos(m.totalPagado)}</td>
                    <td className="px-2 py-1.5 text-right font-medium text-gray-900">{formatoPesos(m.margen)}</td>
                    <td
                      className={`px-2 py-1.5 text-right font-semibold ${
                        m.porcentaje < 30 ? "text-red-600" : m.porcentaje < 50 ? "text-amber-600" : "text-emerald-700"
                      }`}
                    >
                      {m.porcentaje.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {tendenciaMensual.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-gray-700">📈 Tendencia — últimos {tendenciaMensual.length} meses</p>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-3 py-2 text-left font-semibold">Mes</th>
                  <th className="px-2 py-2 text-center font-semibold">Trabajos</th>
                  <th className="px-3 py-2 text-right font-semibold">Pagado a mecánicos</th>
                  <th className="px-3 py-2 text-right font-semibold">Cobrado (vinculados)</th>
                  <th className="px-3 py-2 text-right font-semibold">Margen</th>
                </tr>
              </thead>
              <tbody>
                {tendenciaMensual.map((m) => {
                  return (
                    <tr key={m.mes} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-900">{nombreDelMes(m.mes)}</td>
                      <td className="px-2 py-2 text-center text-gray-600">{m.cantidad}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{formatoPesos(m.totalPagado)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {m.cantidadVinculada > 0 ? formatoPesos(m.totalCobrado) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-emerald-700">
                        {m.cantidadVinculada > 0 ? formatoPesos(m.totalCobrado - m.totalPagadoVinculados) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            "Cobrado" y "Margen" de cada mes solo suman los trabajos de ese mes que quedaron vinculados al catálogo.
          </p>
        </div>
      )}

      <h2 className="mt-8 mb-2 font-heading text-sm font-semibold text-brand-brown">Detalle por mecánico</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Mecánico</th>
              <th className="px-2 py-2 text-center font-semibold">Trabajos</th>
              <th className="px-3 py-2 text-right font-semibold">Total a pagar</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && porLaboratorio.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                  No hay trabajos enviados en este período.
                </td>
              </tr>
            )}
            {porLaboratorio.map((l) => (
              <Fragment key={l.nombre}>
                <tr
                  onClick={() => setExpandido((e) => (e === l.nombre ? null : l.nombre))}
                  className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {expandido === l.nombre ? "▾" : "▸"} {l.nombre}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-600">
                    {l.trabajos.length}
                    {l.cantidadSinValor > 0 && (
                      <span className="ml-1 text-xs text-amber-600" title="Trabajos sin valor cargado">
                        ({l.cantidadSinValor} sin valor)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatoPesos(l.total)}</td>
                </tr>
                {expandido === l.nombre && (
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="px-3 py-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="px-2 py-1 text-left font-medium">Fecha de envío</th>
                            <th className="px-2 py-1 text-left font-medium">Paciente</th>
                            <th className="px-2 py-1 text-left font-medium">Trabajo</th>
                            <th className="px-2 py-1 text-left font-medium">Estado</th>
                            <th className="px-2 py-1 text-right font-medium">Pagamos</th>
                            <th className="px-2 py-1 text-right font-medium">Cobramos</th>
                            <th className="px-2 py-1 text-right font-medium">Margen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {l.trabajos
                            .sort((a, b) => (a.fechaEnvio < b.fechaEnvio ? 1 : -1))
                            .map((t) => {
                              const cobrado = cobradoDe(t);
                              const margen = margenDe(t);
                              return (
                                <tr key={t.id} className="border-t border-gray-200">
                                  <td className="px-2 py-1">{t.fechaEnvio}</td>
                                  <td className="px-2 py-1">{t.pacienteNombre}</td>
                                  <td className="px-2 py-1">
                                    {t.tipoTrabajo}
                                    {t.pieza ? ` (${t.pieza})` : ""}
                                  </td>
                                  <td className="px-2 py-1 text-gray-500">{t.estado}</td>
                                  <td className="px-2 py-1 text-right">
                                    {t.valor ? formatoPesos(t.valor) : <span className="text-amber-600">sin valor</span>}
                                  </td>
                                  <td className="px-2 py-1 text-right">
                                    {cobrado !== null ? formatoPesos(cobrado) : <span className="text-gray-300">sin vincular</span>}
                                  </td>
                                  <td className="px-2 py-1 text-right font-medium">
                                    {margen !== null ? formatoPesos(margen) : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        El valor de cada trabajo se carga al mandarlo al mecánico (o después, desde el detalle del trabajo en
        Laboratorio/Prótesis). Si un trabajo no tiene valor cargado, no suma al total — se marca aparte para que no
        se pierda de vista. "Cobramos" sale del valor de catálogo (efectivo) de la prestación vinculada.
      </p>

      {modalPago && (
        <GastoFormModal
          categorias={categoriasGasto}
          categoriaInicial={CATEGORIA_PAGO_LABORATORIO}
          mecanicoInicial={modalPago}
          laboratoriosSugeridos={laboratoriosSugeridos}
          onClose={() => setModalPago(null)}
          onGuardado={async () => {
            await recargarCuentaCorriente();
            setModalPago(null);
          }}
        />
      )}
    </main>
  );
}

export default function CuentasMecanicosPage() {
  return (
    <SoloDuena>
      <CuentasMecanicosContenido />
    </SoloDuena>
  );
}
