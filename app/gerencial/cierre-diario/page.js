"use client";

import { useEffect, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import { calcularTotalesDelDia } from "@/lib/data/cierres";
import { calcularTotalesDelDiaOrtodoncia } from "@/lib/data/cierresTurnoOrtodoncia";

const ETIQUETAS = [
  { clave: "efectivo", label: "Efectivo" },
  { clave: "transferencia", label: "Transferencia" },
  { clave: "debito", label: "Débito" },
  { clave: "credito", label: "Crédito" },
  { clave: "mercado_pago", label: "Mercado Pago" },
  { clave: "qr", label: "QR" },
];

function TarjetasMedioPago({ totales }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {ETIQUETAS.map((e) => (
        <div key={e.clave} className="rounded-md border border-gray-200 px-3 py-2">
          <p className="text-xs text-gray-500">{e.label}</p>
          <p className="text-base font-semibold text-gray-900">${Number(totales[e.clave]).toLocaleString("es-AR")}</p>
        </div>
      ))}
    </div>
  );
}

function CierreDiarioContenido() {
  const hoy = fechaDeHoyISO();
  const [fecha, setFecha] = useState(hoy);
  const [totalesGeneral, setTotalesGeneral] = useState(null);
  const [totalesOrto, setTotalesOrto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCargando(true);
    Promise.all([calcularTotalesDelDia(fecha), calcularTotalesDelDiaOrtodoncia(fecha)])
      .then(([g, o]) => {
        setTotalesGeneral(g);
        setTotalesOrto(o);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [fecha]);

  const totalesCombinados = ETIQUETAS.reduce((acc, e) => {
    acc[e.clave] = (totalesGeneral?.[e.clave] || 0) + (totalesOrto?.[e.clave] || 0);
    return acc;
  }, {});
  const totalCombinado = (totalesGeneral?.totalGeneral || 0) + (totalesOrto?.totalGeneral || 0);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Cierre Diario — General + Ortodoncia</h1>
      <p className="mt-1 text-sm text-gray-500">
        Cuánto se cobró este día en cada especialidad, separado por medio de pago, y el total combinado.
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
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {cargando || !totalesGeneral || !totalesOrto ? (
        <p className="mt-6 text-sm text-gray-500">Calculando...</p>
      ) : (
        <>
          <h2 className="mt-6 mb-2 font-heading text-sm font-semibold text-brand-brown">
            Odontología General ({totalesGeneral.cantidadCobros} cobros)
          </h2>
          <TarjetasMedioPago totales={totalesGeneral} />
          <p className="mt-1 text-right text-sm font-semibold text-gray-700">
            Total: ${totalesGeneral.totalGeneral.toLocaleString("es-AR")}
          </p>

          <h2 className="mt-6 mb-2 font-heading text-sm font-semibold text-brand-brown">
            Ortodoncia ({totalesOrto.cantidadCobros} cobros)
          </h2>
          <TarjetasMedioPago totales={totalesOrto} />
          <p className="mt-1 text-right text-sm font-semibold text-gray-700">
            Total: ${totalesOrto.totalGeneral.toLocaleString("es-AR")}
          </p>

          <h2 className="mt-6 mb-2 font-heading text-sm font-semibold text-brand-brown">Total combinado</h2>
          <TarjetasMedioPago totales={totalesCombinados} />
          <div className="mt-3 rounded-md bg-brand-brown px-4 py-3 text-white">
            <span className="text-sm">Total del día (ambas especialidades): </span>
            <span className="text-xl font-bold">${totalCombinado.toLocaleString("es-AR")}</span>
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
