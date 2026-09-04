"use client";

import { useEffect, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import { calcularTotalesDelDia } from "@/lib/data/cierres";
import { aprobarCierreDelDia, obtenerCierreDelDia } from "@/lib/data/cierresDia";
import { calcularTotalesDelDiaOrtodoncia } from "@/lib/data/cierresTurnoOrtodoncia";
import { obtenerCobrosPorFecha } from "@/lib/data/caja";
import { obtenerCobrosOrtodonciaPorFecha } from "@/lib/data/cajaOrtodoncia";
import { obtenerPerfiles } from "@/lib/data/perfiles";
import { obtenerGastos } from "@/lib/data/gastos";
import { obtenerPagosProfesionales } from "@/lib/data/pagosProfesionales";

const CLAVE_POR_MEDIO = {
  Efectivo: "efectivo",
  Transferencia: "transferencia",
  "Débito": "debito",
  "Crédito": "credito",
  "Mercado Pago": "mercado_pago",
  QR: "qr",
};

const ETIQUETAS = [
  { clave: "efectivo", label: "Efectivo" },
  { clave: "transferencia", label: "Transferencia" },
  { clave: "debito", label: "Débito" },
  { clave: "credito", label: "Crédito" },
  { clave: "mercado_pago", label: "Mercado Pago" },
  { clave: "qr", label: "QR" },
];

function TarjetasMedioPago({ totales, coloreado }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {ETIQUETAS.map((e) => {
        const monto = Number(totales[e.clave]);
        const color = coloreado ? (monto >= 0 ? "text-brand-green" : "text-red-700") : "text-gray-900";
        return (
          <div key={e.clave} className="rounded-md border border-gray-200 px-3 py-2">
            <p className="text-xs text-gray-500">{e.label}</p>
            <p className={`text-base font-semibold ${color}`}>${monto.toLocaleString("es-AR")}</p>
          </div>
        );
      })}
    </div>
  );
}

function CierreDiarioContenido() {
  const { user, perfil } = useAuth();
  const hoy = fechaDeHoyISO();
  const [fecha, setFecha] = useState(hoy);
  const [totalesGeneral, setTotalesGeneral] = useState(null);
  const [totalesOrto, setTotalesOrto] = useState(null);
  const [cobrosGeneral, setCobrosGeneral] = useState([]);
  const [cobrosOrto, setCobrosOrto] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [pagosProfesionales, setPagosProfesionales] = useState([]);
  const [perfiles, setPerfiles] = useState([]);
  const [cierreAprobado, setCierreAprobado] = useState(null);
  const [observacionesAprobacion, setObservacionesAprobacion] = useState("");
  const [cargando, setCargando] = useState(true);
  const [aprobando, setAprobando] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  async function recargar() {
    setCargando(true);
    setMensaje(null);
    try {
      const [g, o, cg, co, gas, pagos, pf, aprobado] = await Promise.all([
        calcularTotalesDelDia(fecha),
        calcularTotalesDelDiaOrtodoncia(fecha),
        obtenerCobrosPorFecha(fecha),
        obtenerCobrosOrtodonciaPorFecha(fecha),
        obtenerGastos(fecha, fecha),
        obtenerPagosProfesionales(fecha, fecha),
        obtenerPerfiles(),
        obtenerCierreDelDia(fecha),
      ]);
      setTotalesGeneral(g);
      setTotalesOrto(o);
      setCobrosGeneral(cg);
      setCobrosOrto(co);
      setGastos(gas);
      setPagosProfesionales(pagos);
      setPerfiles(pf);
      setCierreAprobado(aprobado);
      setObservacionesAprobacion(aprobado?.observaciones || "");
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  const totalesCombinados = ETIQUETAS.reduce((acc, e) => {
    acc[e.clave] = (totalesGeneral?.[e.clave] || 0) + (totalesOrto?.[e.clave] || 0);
    return acc;
  }, {});
  const totalCombinado = (totalesGeneral?.totalGeneral || 0) + (totalesOrto?.totalGeneral || 0);

  // Los sueldos (Registrar sueldo, en Consultorio) no salen de la plata
  // que entró hoy: salen de la reserva acumulada en Consultorio. Por eso
  // no cuentan como egreso del día acá.
  const gastosDelDia = gastos.filter((g) => g.categoria !== "Sueldos");

  const totalesEgresos = ETIQUETAS.reduce((acc, e) => {
    acc[e.clave] = 0;
    return acc;
  }, {});
  [...gastosDelDia, ...pagosProfesionales].forEach((m) => {
    const clave = CLAVE_POR_MEDIO[m.medioPago];
    if (clave) totalesEgresos[clave] += Number(m.monto);
  });
  const totalEgresos = Object.values(totalesEgresos).reduce((a, b) => a + b, 0);

  const totalesNeto = ETIQUETAS.reduce((acc, e) => {
    acc[e.clave] = (totalesCombinados[e.clave] || 0) - (totalesEgresos[e.clave] || 0);
    return acc;
  }, {});
  const totalNeto = totalCombinado - totalEgresos;

  const detalleEnVivo = {
    totalesGeneral,
    totalesOrto,
    totalesCombinados,
    totalCombinado,
    totalesEgresos,
    totalEgresos,
    totalesNeto,
    totalNeto,
    cantidadGastos: gastosDelDia.length,
    cantidadPagosProfesionales: pagosProfesionales.length,
  };

  const detalleCongelado = cierreAprobado?.detalle || null;
  const detalleMostrado = detalleCongelado || detalleEnVivo;
  const hayDiscrepancia =
    detalleCongelado &&
    (detalleCongelado.totalCombinado !== totalCombinado ||
      detalleCongelado.totalEgresos !== totalEgresos ||
      detalleCongelado.totalNeto !== totalNeto);

  const nombrePorUsuario = (usuarioId) => perfiles.find((p) => p.id === usuarioId)?.nombre || "—";

  const movimientos = [
    ...cobrosGeneral.map((c) => ({
      id: `g-${c.id}`,
      especialidad: "General",
      hora: c.createdAt,
      paciente: c.paciente,
      concepto:
        c.modalidad === "Plan de financiación"
          ? `Plan ${c.idDocumento}`
          : c.prestaciones.map((p) => p.prestacion).join(", ") || "—",
      importe: Number(c.pago),
      medioPago: c.medioPago,
      cargadoPor: nombrePorUsuario(c.usuarioId),
      cerrado: c.cerrado,
    })),
    ...cobrosOrto.map((c) => ({
      id: `o-${c.id}`,
      especialidad: "Ortodoncia",
      hora: c.createdAt,
      paciente: c.paciente,
      concepto: c.concepto,
      importe: Number(c.importe),
      medioPago: c.medioPago,
      cargadoPor: nombrePorUsuario(c.usuarioId),
      cerrado: c.cerrado,
    })),
  ].sort((a, b) => (a.hora < b.hora ? 1 : -1));

  async function handleAprobar() {
    setAprobando(true);
    setError(null);
    setMensaje(null);
    try {
      const aprobado = await aprobarCierreDelDia(
        fecha,
        user.id,
        perfil?.nombre || user.email,
        observacionesAprobacion,
        detalleEnVivo
      );
      setCierreAprobado(aprobado);
      setMensaje("Día aprobado y congelado correctamente.");
    } catch (e) {
      setError(e.message);
    } finally {
      setAprobando(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Cierre Diario — General + Ortodoncia</h1>
      <p className="mt-1 text-sm text-gray-500">
        Cada cobro aparece acá apenas se registra. Revisá que esté todo bien y aprobá el día una vez que los
        secretarios ya cerraron sus turnos.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => setFecha((f) => sumarDias(f, -1))}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
        >
          ← Día anterior
        </button>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          onClick={() => setFecha((f) => sumarDias(f, 1))}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
        >
          Día siguiente →
        </button>
        <button
          onClick={() => setFecha(hoy)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
        >
          Hoy
        </button>
        <button
          onClick={recargar}
          className="ml-auto rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          ↻ Actualizar
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
      {mensaje && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {mensaje}
        </div>
      )}

      {detalleCongelado && (
        <div className="mt-4 rounded-md border border-brand-tan bg-brand-tan/10 px-3 py-2 text-sm text-brand-brown">
          🔒 Este día ya está cerrado — se muestran los números <strong>congelados</strong> del momento de la
          aprobación, no los que se calculan en vivo.
        </div>
      )}
      {hayDiscrepancia && (
        <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⚠️ Los datos en vivo cambiaron desde que se cerró este día (por ejemplo, se cargó o borró un gasto/pago
          después). Neto congelado: ${Number(detalleCongelado.totalNeto).toLocaleString("es-AR")} — neto en vivo
          ahora: ${totalNeto.toLocaleString("es-AR")}. Si esto es correcto, volvé a aprobar el cierre para
          actualizarlo.
        </div>
      )}

      {cargando || !totalesGeneral || !totalesOrto ? (
        <p className="mt-6 text-sm text-gray-500">Calculando...</p>
      ) : (
        <>
          <h2 className="mt-6 mb-2 font-heading text-sm font-semibold text-brand-brown">
            Odontología General ({detalleMostrado.totalesGeneral.cantidadCobros} cobros)
          </h2>
          <TarjetasMedioPago totales={detalleMostrado.totalesGeneral} />
          <p className="mt-1 text-right text-sm font-semibold text-gray-700">
            Total: ${detalleMostrado.totalesGeneral.totalGeneral.toLocaleString("es-AR")}
          </p>

          <h2 className="mt-6 mb-2 font-heading text-sm font-semibold text-brand-brown">
            Ortodoncia ({detalleMostrado.totalesOrto.cantidadCobros} cobros)
          </h2>
          <TarjetasMedioPago totales={detalleMostrado.totalesOrto} />
          <p className="mt-1 text-right text-sm font-semibold text-gray-700">
            Total: ${detalleMostrado.totalesOrto.totalGeneral.toLocaleString("es-AR")}
          </p>

          <h2 className="mt-6 mb-2 font-heading text-sm font-semibold text-brand-brown">Total combinado</h2>
          <TarjetasMedioPago totales={detalleMostrado.totalesCombinados} />
          <div className="mt-3 rounded-md bg-brand-brown px-4 py-3 text-white">
            <span className="text-sm">Total del día (ambas especialidades): </span>
            <span className="text-xl font-bold">${detalleMostrado.totalCombinado.toLocaleString("es-AR")}</span>
          </div>

          <h2 className="mt-6 mb-2 font-heading text-sm font-semibold text-brand-brown">
            Egresos del día ({detalleMostrado.cantidadGastos} gastos + {detalleMostrado.cantidadPagosProfesionales}{" "}
            pagos a profesionales)
          </h2>
          <TarjetasMedioPago totales={detalleMostrado.totalesEgresos} />
          <p className="mt-1 text-right text-sm font-semibold text-gray-700">
            Total: ${detalleMostrado.totalEgresos.toLocaleString("es-AR")}
          </p>

          <h2 className="mt-6 mb-2 font-heading text-sm font-semibold text-brand-brown">
            Lo que queda limpio (ingresos − egresos)
          </h2>
          <TarjetasMedioPago totales={detalleMostrado.totalesNeto} coloreado />
          <div
            className={`mt-3 rounded-md px-4 py-3 text-white ${detalleMostrado.totalNeto >= 0 ? "bg-brand-green" : "bg-red-700"}`}
          >
            <span className="text-sm">Neto del día: </span>
            <span className="text-xl font-bold">${detalleMostrado.totalNeto.toLocaleString("es-AR")}</span>
          </div>

          <h2 className="mt-8 mb-2 font-heading text-sm font-semibold text-brand-brown">
            Detalle de cobros del día ({movimientos.length})
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-3 py-2 text-left font-semibold">Hora</th>
                  <th className="px-3 py-2 text-left font-semibold">Especialidad</th>
                  <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                  <th className="px-3 py-2 text-left font-semibold">Concepto</th>
                  <th className="px-3 py-2 text-right font-semibold">Importe</th>
                  <th className="px-3 py-2 text-left font-semibold">Medio</th>
                  <th className="px-3 py-2 text-left font-semibold">Cargado por</th>
                  <th className="px-3 py-2 text-left font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                      No hay cobros registrados este día.
                    </td>
                  </tr>
                )}
                {movimientos.map((m) => (
                  <tr key={m.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-500">
                      {new Date(m.hora).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          m.especialidad === "Ortodoncia" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        {m.especialidad}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">{m.paciente}</td>
                    <td className="px-3 py-2 text-gray-600">{m.concepto}</td>
                    <td className="px-3 py-2 text-right text-gray-600">${m.importe.toLocaleString("es-AR")}</td>
                    <td className="px-3 py-2 text-gray-600">{m.medioPago}</td>
                    <td className="px-3 py-2 text-gray-600">{m.cargadoPor}</td>
                    <td className="px-3 py-2 text-xs">
                      {m.cerrado ? (
                        <span className="text-gray-400">🔒 Cerrado</span>
                      ) : (
                        <span className="text-amber-600">Abierto</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 rounded-lg border border-brand-tan bg-brand-tan/10 p-4">
            <h2 className="font-heading text-sm font-semibold text-brand-brown">Cierre final del día</h2>
            {cierreAprobado ? (
              <p className="mt-1 text-sm text-brand-green">
                ✅ Aprobado por {cierreAprobado.nombre_duena} el{" "}
                {new Date(cierreAprobado.aprobado_en).toLocaleString("es-AR")}, con los números de ese momento
                congelados. Si volvés a aprobar, se vuelve a congelar con los números actuales.
              </p>
            ) : (
              <p className="mt-1 text-sm text-gray-500">Todavía no aprobaste este día.</p>
            )}
            <label className="mt-3 flex flex-col gap-1 text-sm text-gray-700">
              Observaciones (opcional)
              <input
                value={observacionesAprobacion}
                onChange={(e) => setObservacionesAprobacion(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <button
              onClick={handleAprobar}
              disabled={aprobando}
              className="mt-3 rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {aprobando ? "Guardando..." : cierreAprobado ? "Actualizar aprobación" : "✅ Aprobar cierre del día"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default function CierreDiarioGerencialPage() {
  return (
    <SoloDuena>
      <CierreDiarioContenido />
    </SoloDuena>
  );
}
