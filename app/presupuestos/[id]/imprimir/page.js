"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { obtenerPresupuestoPorId } from "@/lib/data/presupuestos";

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

export default function ImprimirPresupuestoPage() {
  const { id } = useParams();
  const [presupuesto, setPresupuesto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    obtenerPresupuestoPorId(id)
      .then(setPresupuesto)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [id]);

  if (cargando) return <p className="p-10 text-sm text-gray-500">Cargando...</p>;
  if (error) return <p className="p-10 text-sm text-red-700">{error}</p>;
  if (!presupuesto) return null;

  const vigenciaHasta = (() => {
    const f = new Date(presupuesto.fecha + "T00:00:00");
    f.setDate(f.getDate() + 30);
    return f.toISOString().slice(0, 10);
  })();

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between p-4 print:hidden">
        <Link href="/presupuestos" className="text-sm text-brand-brown hover:underline">
          ← Volver a Presupuestos
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
        >
          🖨 Imprimir / Guardar como PDF
        </button>
      </div>

      <div className="mx-auto max-w-3xl bg-white p-10 shadow-sm print:shadow-none print:p-0">
        <div className="flex items-center justify-between border-b-2 border-brand-brown pb-4">
          <div className="flex items-center gap-3">
            <Image src="/icon.png" alt="" width={56} height={56} />
            <div>
              <p className="font-heading text-lg font-semibold text-brand-brown">Clínica Dental</p>
              <p className="text-sm text-brand-charcoal/70">Marianela Ramírez</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-heading text-xl font-semibold text-brand-brown">Presupuesto</p>
            <p className="text-sm text-gray-600">N.º {presupuesto.numero}</p>
            <p className="text-sm text-gray-600">Fecha: {formatoFecha(presupuesto.fecha)}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400">Paciente</p>
            <p className="font-medium text-gray-900">{presupuesto.paciente}</p>
            {presupuesto.pacienteDni && <p className="text-gray-600">DNI: {presupuesto.pacienteDni}</p>}
            {presupuesto.pacienteCelular && <p className="text-gray-600">Cel.: {presupuesto.pacienteCelular}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400">Profesional</p>
            <p className="font-medium text-gray-900">{presupuesto.profesional}</p>
          </div>
        </div>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-brand-brown text-left text-brand-brown">
              <th className="py-2 font-semibold">Prestación</th>
              <th className="py-2 text-center font-semibold">Cantidad</th>
              <th className="py-2 text-center font-semibold">Precio</th>
              <th className="py-2 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {presupuesto.prestaciones.map((p, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-2 text-gray-900">{p.prestacion}</td>
                <td className="py-2 text-center text-gray-600">{p.cantidad}</td>
                <td className="py-2 text-center text-gray-600">{p.tipoPrecio}</td>
                <td className="py-2 text-right text-gray-900">${Number(p.importe).toLocaleString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-64 rounded-md bg-brand-tan/20 px-4 py-3">
            <div className="flex justify-between text-lg font-semibold text-brand-brown">
              <span>Total</span>
              <span>${Number(presupuesto.total).toLocaleString("es-AR")}</span>
            </div>
          </div>
        </div>

        {presupuesto.modalidadPago && (
          <div className="mt-6 rounded-md border border-gray-200 p-4 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Condiciones de pago</p>
            <p className="text-gray-700">
              Modalidad: <span className="font-medium">{presupuesto.modalidadPago}</span>
              {presupuesto.modalidadPago === "Financiado" && (
                <> — {presupuesto.cantidadCuotas} cuotas</>
              )}
            </p>
            {presupuesto.modalidadPago === "Financiado" && (
              <div className="mt-1 grid grid-cols-2 gap-2 text-gray-700">
                <p>Anticipo: ${Number(presupuesto.anticipo).toLocaleString("es-AR")}</p>
                <p>Saldo a financiar: ${Number(presupuesto.saldo).toLocaleString("es-AR")}</p>
              </div>
            )}
          </div>
        )}

        {presupuesto.observaciones && (
          <div className="mt-4 text-sm">
            <p className="text-xs font-semibold uppercase text-gray-400">Observaciones</p>
            <p className="text-gray-700">{presupuesto.observaciones}</p>
          </div>
        )}

        <div className="mt-10 flex items-end justify-between text-xs text-gray-500">
          <p>Presupuesto válido hasta el {formatoFecha(vigenciaHasta)}.</p>
          <div className="text-center">
            <div className="mb-1 h-10 w-48 border-b border-gray-400" />
            <p>Firma del paciente</p>
          </div>
        </div>
      </div>
    </div>
  );
}
