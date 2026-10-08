"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuenaYContador from "@/components/SoloDuenaYContador";
import { obtenerSaldosPersonales } from "@/lib/data/finanzasPersonales";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  fechaHoraArgentina,
  obtenerHistorialGastos,
  obtenerHistorialPagos,
  obtenerHistorialReserva,
} from "@/lib/data/historialPagos";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function nombreMes(claveMes) {
  const [anio, mes] = claveMes.split("-");
  return `${NOMBRES_MES[Number(mes) - 1]} ${anio}`;
}

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function celdaCSV(valor) {
  const texto = String(valor ?? "");
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function rangoDelMes(mesISO) {
  const [anio, mes] = mesISO.split("-").map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return { desde: `${mesISO}-01`, hasta: `${mesISO}-${String(ultimoDia).padStart(2, "0")}` };
}

function descargarCSV(nombreArchivo, lineas) {
  // Punto y coma + BOM: así Excel en español lo abre directo en columnas y con tildes.
  const contenido = "﻿" + lineas.map((l) => l.map(celdaCSV).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

const ESTILO_ORIGEN = {
  "Caja del día": "bg-sky-100 text-sky-800",
  Reserva: "bg-amber-100 text-amber-800",
  Producción: "bg-violet-100 text-violet-800",
  "Plata del mes": "bg-emerald-100 text-emerald-800",
};

// Filtro de período (un mes / entre fechas / todo) + carga de datos, igual para
// las dos pestañas.
function usePeriodo(cargar) {
  const hoy = fechaDeHoyISO();
  const [modo, setModo] = useState("mes");
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [desde, setDesde] = useState(`${hoy.slice(0, 4)}-01-01`);
  const [hasta, setHasta] = useState(hoy);
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let fechaDesde = null;
    let fechaHasta = null;
    if (modo === "mes") ({ desde: fechaDesde, hasta: fechaHasta } = rangoDelMes(mes));
    if (modo === "rango") {
      fechaDesde = desde || null;
      fechaHasta = hasta || null;
    }
    setCargando(true);
    setError(null);
    cargar(fechaDesde, fechaHasta)
      .then(setFilas)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, mes, desde, hasta]);

  return { modo, setModo, mes, setMes, desde, setDesde, hasta, setHasta, filas, cargando, error, hoy };
}

function SelectorPeriodo({ p }) {
  return (
    <>
      <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
        {[
          ["mes", "Un mes"],
          ["rango", "Entre fechas"],
          ["todo", "Todo"],
        ].map(([clave, texto]) => (
          <button
            key={clave}
            onClick={() => p.setModo(clave)}
            className={`px-3 py-1.5 ${
              p.modo === clave ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>
      {p.modo === "mes" && (
        <input
          type="month"
          value={p.mes}
          onChange={(e) => e.target.value && p.setMes(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      )}
      {p.modo === "rango" && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <input type="date" value={p.desde} onChange={(e) => p.setDesde(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          a
          <input type="date" value={p.hasta} onChange={(e) => p.setHasta(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
      )}
    </>
  );
}

// Agrupa por mes (el más nuevo primero) con el total y un desglose por `claveDesglose`.
function agruparPorMes(filas, claveDesglose) {
  const porMes = new Map();
  for (const f of filas) {
    const clave = f.fecha.slice(0, 7);
    if (!porMes.has(clave)) porMes.set(clave, []);
    porMes.get(clave).push(f);
  }
  return [...porMes.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([clave, lista]) => ({
      clave,
      filas: lista,
      total: lista.reduce((s, f) => s + f.monto, 0),
      desglose: Object.values(
        lista.reduce((acc, f) => {
          const k = claveDesglose(f);
          acc[k] ??= { nombre: k, total: 0 };
          acc[k].total += f.monto;
          return acc;
        }, {})
      ).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    }));
}

function CabeceraMes({ m, unidad }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-brand-brown pb-1">
        <h2 className="text-xl font-bold text-brand-brown">{nombreMes(m.clave)}</h2>
        <p className="text-sm text-gray-700">
          {m.filas.length} {unidad}
          {m.filas.length === 1 ? "" : "s"} · <strong>Total del mes: {formatoPesos(m.total)}</strong>
        </p>
      </div>
      <p className="mt-1.5 text-xs text-gray-500">
        {m.desglose.map((p, i) => (
          <span key={p.nombre}>
            {i > 0 && " · "}
            {p.nombre}: <strong>{formatoPesos(p.total)}</strong>
          </span>
        ))}
      </p>
    </>
  );
}

function Etiqueta({ texto }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTILO_ORIGEN[texto]}`}>{texto}</span>;
}

function PagosAProfesionales() {
  const p = usePeriodo(obtenerHistorialPagos);
  const [profesionalElegido, setProfesionalElegido] = useState("todos");
  const [salioDeElegido, setSalioDeElegido] = useState("todos");

  const profesionales = useMemo(() => {
    const mapa = new Map();
    for (const f of p.filas) mapa.set(f.profesionalId, f.profesional);
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [p.filas]);

  const filtrados = useMemo(
    () =>
      p.filas.filter(
        (f) =>
          (profesionalElegido === "todos" || f.profesionalId === profesionalElegido) &&
          (salioDeElegido === "todos" || f.salioDe === salioDeElegido)
      ),
    [p.filas, profesionalElegido, salioDeElegido]
  );
  const meses = useMemo(() => agruparPorMes(filtrados, (f) => f.profesional), [filtrados]);

  function descargar() {
    const lineas = [
      ["Fecha del pago", "Registrado (fecha y hora)", "Registró", "Profesional", "Tipo", "Salió de", "Medio de pago", "Monto", "Observaciones"],
    ];
    for (const f of filtrados) {
      lineas.push([
        formatoFecha(f.fecha), fechaHoraArgentina(f.registradoEn), f.registradoPor || "", f.profesional, f.tipo,
        f.salioDe, f.medioPago, f.monto, f.observaciones || "",
      ]);
    }
    descargarCSV(`historial-pagos-profesionales-${p.hoy}.csv`, lineas);
  }

  return (
    <>
      <p className="mt-0.5 text-sm text-gray-500">
        Todo lo que se le pagó a cada profesional: la fecha del pago, cuándo y quién lo registró, el monto y de dónde
        salió la plata.
      </p>
      {p.error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{p.error}</div>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SelectorPeriodo p={p} />
        <select value={profesionalElegido} onChange={(e) => setProfesionalElegido(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="todos">Todos los profesionales</option>
          {profesionales.map(([id, nombre]) => (
            <option key={id} value={id}>{nombre}</option>
          ))}
        </select>
        <select value={salioDeElegido} onChange={(e) => setSalioDeElegido(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="todos">Salió de: todo</option>
          <option value="Caja del día">Caja del día</option>
          <option value="Reserva">Reserva del Consultorio</option>
          <option value="Producción">Producción y liquidación</option>
        </select>
        <button onClick={descargar} disabled={p.cargando || filtrados.length === 0} className="ml-auto rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          ⬇ Descargar para Excel
        </button>
      </div>

      {p.cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : meses.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No hay pagos registrados para este filtro.</p>
      ) : (
        meses.map((m) => (
          <section key={m.clave} className="mt-8">
            <CabeceraMes m={m} unidad="pago" />
            <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-brown text-white">
                    <th className="px-3 py-2 text-left font-semibold">Fecha del pago</th>
                    <th className="px-3 py-2 text-left font-semibold">Registrado</th>
                    <th className="px-3 py-2 text-left font-semibold">Registró</th>
                    <th className="px-3 py-2 text-left font-semibold">Profesional</th>
                    <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                    <th className="px-3 py-2 text-left font-semibold">Salió de</th>
                    <th className="px-3 py-2 text-left font-semibold">Medio</th>
                    <th className="px-3 py-2 text-right font-semibold">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {m.filas.map((f) => (
                    <tr key={f.id} className="border-t border-gray-100 align-top">
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-800">{formatoFecha(f.fecha)}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-500">{fechaHoraArgentina(f.registradoEn)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.registradoPor || "—"}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {f.profesional}
                        {f.observaciones && <span className="block text-[11px] font-normal text-gray-500">{f.observaciones}</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{f.tipo}</td>
                      <td className="px-3 py-2"><Etiqueta texto={f.salioDe} /></td>
                      <td className="px-3 py-2 text-gray-600">{f.medioPago}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatoPesos(f.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </>
  );
}

function Gastos() {
  const p = usePeriodo(obtenerHistorialGastos);
  const [categoriaElegida, setCategoriaElegida] = useState("todas");
  const [salioDeElegido, setSalioDeElegido] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  const categorias = useMemo(
    () => [...new Set(p.filas.map((f) => f.categoria))].sort((a, b) => a.localeCompare(b, "es")),
    [p.filas]
  );

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return p.filas.filter(
      (f) =>
        (categoriaElegida === "todas" || f.categoria === categoriaElegida) &&
        (salioDeElegido === "todos" || f.salioDe === salioDeElegido) &&
        (!texto || (f.descripcion || "").toLowerCase().includes(texto) || (f.observaciones || "").toLowerCase().includes(texto))
    );
  }, [p.filas, categoriaElegida, salioDeElegido, busqueda]);
  const meses = useMemo(() => agruparPorMes(filtrados, (f) => f.categoria), [filtrados]);

  function descargar() {
    const lineas = [
      ["Fecha del gasto", "Registrado (fecha y hora)", "Registró", "Categoría", "Descripción", "Salió de", "Medio de pago", "Monto", "Observaciones"],
    ];
    for (const f of filtrados) {
      lineas.push([
        formatoFecha(f.fecha), fechaHoraArgentina(f.registradoEn), f.registradoPor || "", f.categoria,
        f.descripcion || "", f.salioDe, f.medioPago, f.monto, f.observaciones || "",
      ]);
    }
    descargarCSV(`historial-gastos-${p.hoy}.csv`, lineas);
  }

  return (
    <>
      <p className="mt-0.5 text-sm text-gray-500">
        Todos los gastos cargados: la fecha, cuándo y quién los registró, el monto y si salieron de la reserva del
        Consultorio o de la plata del mes.
      </p>
      {p.error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{p.error}</div>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SelectorPeriodo p={p} />
        <select value={categoriaElegida} onChange={(e) => setCategoriaElegida(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="todas">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={salioDeElegido} onChange={(e) => setSalioDeElegido(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="todos">Salió de: todo</option>
          <option value="Reserva">Reserva del Consultorio</option>
          <option value="Plata del mes">Plata del mes</option>
        </select>
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar en la descripción..." className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
        <button onClick={descargar} disabled={p.cargando || filtrados.length === 0} className="ml-auto rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          ⬇ Descargar para Excel
        </button>
      </div>

      {p.cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : meses.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No hay gastos registrados para este filtro.</p>
      ) : (
        meses.map((m) => (
          <section key={m.clave} className="mt-8">
            <CabeceraMes m={m} unidad="gasto" />
            <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-brown text-white">
                    <th className="px-3 py-2 text-left font-semibold">Fecha del gasto</th>
                    <th className="px-3 py-2 text-left font-semibold">Registrado</th>
                    <th className="px-3 py-2 text-left font-semibold">Registró</th>
                    <th className="px-3 py-2 text-left font-semibold">Categoría</th>
                    <th className="px-3 py-2 text-left font-semibold">Descripción</th>
                    <th className="px-3 py-2 text-left font-semibold">Salió de</th>
                    <th className="px-3 py-2 text-left font-semibold">Medio</th>
                    <th className="px-3 py-2 text-right font-semibold">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {m.filas.map((f) => (
                    <tr key={f.id} className="border-t border-gray-100 align-top">
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-800">{formatoFecha(f.fecha)}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-500">{fechaHoraArgentina(f.registradoEn)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.registradoPor || "—"}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{f.categoria}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {f.descripcion || "—"}
                        {f.observaciones && <span className="block text-[11px] text-gray-500">{f.observaciones}</span>}
                      </td>
                      <td className="px-3 py-2"><Etiqueta texto={f.salioDe} /></td>
                      <td className="px-3 py-2 text-gray-600">{f.medioPago}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatoPesos(f.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </>
  );
}

function Reserva() {
  const p = usePeriodo(obtenerHistorialReserva);
  const [saldos, setSaldos] = useState(null);
  const [cuentaElegida, setCuentaElegida] = useState("todas");
  const [tipoElegido, setTipoElegido] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    obtenerSaldosPersonales("Consultorio").then(setSaldos).catch(() => setSaldos(null));
  }, []);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return p.filas.filter(
      (f) =>
        (cuentaElegida === "todas" || f.cuenta === cuentaElegida) &&
        (tipoElegido === "todos" || f.tipo === tipoElegido) &&
        (!texto || (f.descripcion || "").toLowerCase().includes(texto) || f.categoria.toLowerCase().includes(texto))
    );
  }, [p.filas, cuentaElegida, tipoElegido, busqueda]);

  // Mes por mes: lo que entró, lo que salió y el resultado del mes.
  const meses = useMemo(() => {
    const porMes = new Map();
    for (const f of filtrados) {
      const clave = f.fecha.slice(0, 7);
      if (!porMes.has(clave)) porMes.set(clave, []);
      porMes.get(clave).push(f);
    }
    return [...porMes.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([clave, filas]) => {
        const ingresos = filas.filter((f) => f.tipo === "Ingreso").reduce((s, f) => s + f.monto, 0);
        const egresos = filas.filter((f) => f.tipo === "Egreso").reduce((s, f) => s + f.monto, 0);
        return { clave, filas, ingresos, egresos };
      });
  }, [filtrados]);

  function descargar() {
    const lineas = [
      ["Fecha", "Registrado (fecha y hora)", "Registró", "Cuenta", "Tipo", "Categoría", "Descripción", "Monto (con signo)"],
    ];
    for (const f of filtrados) {
      lineas.push([
        formatoFecha(f.fecha), fechaHoraArgentina(f.registradoEn), f.registradoPor || "", f.cuenta, f.tipo,
        f.categoria, f.descripcion || "", f.tipo === "Ingreso" ? f.monto : -f.monto,
      ]);
    }
    descargarCSV(`historial-reserva-${p.hoy}.csv`, lineas);
  }

  return (
    <>
      <p className="mt-0.5 text-sm text-gray-500">
        Todo lo que entró y salió de la reserva del Consultorio: cuándo y quién lo registró, de qué cuenta (Efectivo o
        Banco) y por qué. No incluye el panel Personal, que es privado de cada dueña.
      </p>
      {saldos && (
        <div className="mt-3 flex flex-wrap gap-3">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2">
            <p className="text-xs uppercase text-gray-400">💵 Efectivo hoy</p>
            <p className="text-lg font-bold text-gray-900">{formatoPesos(saldos.Efectivo)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2">
            <p className="text-xs uppercase text-gray-400">🏦 Banco hoy</p>
            <p className="text-lg font-bold text-gray-900">{formatoPesos(saldos.Banco)}</p>
          </div>
          <div className="rounded-lg bg-brand-brown px-4 py-2 text-white">
            <p className="text-xs uppercase text-white/70">Total disponible</p>
            <p className="text-lg font-bold">{formatoPesos(saldos.Efectivo + saldos.Banco)}</p>
          </div>
        </div>
      )}
      {p.error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{p.error}</div>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SelectorPeriodo p={p} />
        <select value={cuentaElegida} onChange={(e) => setCuentaElegida(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="todas">Efectivo y Banco</option>
          <option value="Efectivo">Solo Efectivo</option>
          <option value="Banco">Solo Banco</option>
        </select>
        <select value={tipoElegido} onChange={(e) => setTipoElegido(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="todos">Ingresos y egresos</option>
          <option value="Ingreso">Solo ingresos</option>
          <option value="Egreso">Solo egresos</option>
        </select>
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar categoría o descripción..." className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
        <button onClick={descargar} disabled={p.cargando || filtrados.length === 0} className="ml-auto rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          ⬇ Descargar para Excel
        </button>
      </div>

      {p.cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : meses.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No hay movimientos de la reserva para este filtro.</p>
      ) : (
        meses.map((m) => (
          <section key={m.clave} className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-brand-brown pb-1">
              <h2 className="text-xl font-bold text-brand-brown">{nombreMes(m.clave)}</h2>
              <p className="text-sm text-gray-700">
                Entró <strong className="text-emerald-700">{formatoPesos(m.ingresos)}</strong> · Salió{" "}
                <strong className="text-red-700">{formatoPesos(m.egresos)}</strong> · Resultado del mes{" "}
                <strong>
                  {m.ingresos - m.egresos < 0 ? "-" : ""}
                  {formatoPesos(Math.abs(m.ingresos - m.egresos))}
                </strong>
              </p>
            </div>
            <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-brown text-white">
                    <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                    <th className="px-3 py-2 text-left font-semibold">Registrado</th>
                    <th className="px-3 py-2 text-left font-semibold">Registró</th>
                    <th className="px-3 py-2 text-left font-semibold">Cuenta</th>
                    <th className="px-3 py-2 text-left font-semibold">Categoría</th>
                    <th className="px-3 py-2 text-left font-semibold">Descripción</th>
                    <th className="px-3 py-2 text-right font-semibold">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {m.filas.map((f) => (
                    <tr key={f.id} className="border-t border-gray-100 align-top">
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-800">{formatoFecha(f.fecha)}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-500">{fechaHoraArgentina(f.registradoEn)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">{f.registradoPor || "—"}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {f.cuenta === "Efectivo" ? "💵" : "🏦"} {f.cuenta}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900">{f.categoria}</td>
                      <td className="px-3 py-2 text-gray-700">{f.descripcion || "—"}</td>
                      <td
                        className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${
                          f.tipo === "Ingreso" ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {f.tipo === "Ingreso" ? "+" : "-"}
                        {formatoPesos(f.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </>
  );
}

const PESTANAS = [
  { id: "profesionales", label: "👩‍⚕️ Pagos a profesionales" },
  { id: "gastos", label: "🧾 Gastos" },
  { id: "reserva", label: "🏦 Reserva del Consultorio" },
];

function PaginaHistorialPagos() {
  const [pestana, setPestana] = useState("profesionales");
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Historial de pagos</h1>
      <div className="mt-3 flex gap-2 border-b border-gray-200">
        {PESTANAS.map((t) => (
          <button
            key={t.id}
            onClick={() => setPestana(t.id)}
            className={`-mb-px rounded-t-md border-b-2 px-4 py-2 text-sm font-medium ${
              pestana === t.id ? "border-brand-brown text-brand-brown" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {pestana === "profesionales" && <PagosAProfesionales />}
      {pestana === "gastos" && <Gastos />}
      {pestana === "reserva" && <Reserva />}
    </main>
  );
}

export default function HistorialPagosPage() {
  return (
    <SoloDuenaYContador>
      <PaginaHistorialPagos />
    </SoloDuenaYContador>
  );
}
