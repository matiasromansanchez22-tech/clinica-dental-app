"use client";

import { useEffect, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import GastoRecurrenteFormModal from "@/components/GastoRecurrenteFormModal";
import RegistrarPagoRecurrenteModal from "@/components/RegistrarPagoRecurrenteModal";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerCategoriasGasto } from "@/lib/data/gastos";
import { obtenerGastosRecurrentes, obtenerPagosDelMesPorNombre } from "@/lib/data/gastosRecurrentes";

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}`;
}

function primerYUltimoDiaDelMes(fechaISO) {
  const [anio, mes] = fechaISO.split("-").map(Number);
  const primero = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const ultimo = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { primero, ultimo };
}

function FilaGasto({ gasto, pagos, onPagar, onEditar }) {
  const ultimoPago = pagos?.[0] || null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-3 py-2.5 first:border-t-0">
      <button type="button" onClick={() => onEditar(gasto)} className="text-left hover:underline">
        <span className="font-medium text-gray-900">{gasto.nombre}</span>{" "}
        <span className="text-xs text-gray-400">({gasto.categoria})</span>
        {gasto.montoSugerido && <span className="ml-2 text-xs text-gray-400">~ {formatoPesos(gasto.montoSugerido)}</span>}
      </button>
      <div className="flex items-center gap-3">
        {ultimoPago ? (
          <span className="text-xs font-medium text-emerald-700">
            ✓ Pagado {formatoFecha(ultimoPago.fecha)} — {formatoPesos(ultimoPago.monto)}
          </span>
        ) : (
          <span className="text-xs font-medium text-amber-600">Pendiente este mes</span>
        )}
        <button
          type="button"
          onClick={() => onPagar(gasto)}
          className="rounded-md border border-brand-brown/40 px-3 py-1.5 text-xs font-medium text-brand-brown hover:bg-brand-tan/30"
        >
          💳 Pago
        </button>
      </div>
    </div>
  );
}

function GastosRecurrentesContenido() {
  const hoy = fechaDeHoyISO();
  const { primero, ultimo } = primerYUltimoDiaDelMes(hoy);
  const [gastos, setGastos] = useState([]);
  const [pagosPorNombre, setPagosPorNombre] = useState({});
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [modalPago, setModalPago] = useState(null);
  const [modalEdicion, setModalEdicion] = useState(null); // { gasto } o { gasto: null } para nuevo
  const [mostrarNuevo, setMostrarNuevo] = useState(false);

  async function recargar() {
    setCargando(true);
    setError(null);
    try {
      const [g, p, c] = await Promise.all([
        obtenerGastosRecurrentes(),
        obtenerPagosDelMesPorNombre(primero, ultimo),
        obtenerCategoriasGasto(),
      ]);
      setGastos(g);
      setPagosPorNombre(p);
      setCategorias(c);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fijos = gastos.filter((g) => g.tipo === "Fijo");
  const variables = gastos.filter((g) => g.tipo === "Variable");
  const pendientes = gastos.filter((g) => !pagosPorNombre[g.nombre]).length;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">💼 Gastos de la Clínica</h1>
          <p className="mt-1 text-sm text-gray-500">
            Privado — solo lo ven Marianela y Matías. Todos los gastos fijos y variables de siempre, para tildarlos
            pagados con un toque en vez de cargar el formulario completo cada vez.
          </p>
        </div>
        <button
          onClick={() => setMostrarNuevo(true)}
          className="whitespace-nowrap rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
        >
          + Agregar
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {!cargando && gastos.length > 0 && (
        <div className="mt-4 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600">
          Este mes: <span className="font-semibold text-gray-900">{gastos.length - pendientes}</span> de{" "}
          <span className="font-semibold text-gray-900">{gastos.length}</span> ya pagados
          {pendientes > 0 && <span className="text-amber-600"> — quedan {pendientes} pendientes</span>}
        </div>
      )}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : gastos.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          Todavía no cargaste ningún gasto acá. Empezá con "+ Agregar" — por ejemplo Alquiler, Impuestos, Internet,
          Seguro.
        </p>
      ) : (
        <>
          <h2 className="mt-6 mb-1 font-heading text-sm font-semibold text-brand-brown">Gastos Fijos</h2>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            {fijos.length === 0 ? (
              <p className="px-3 py-3 text-sm text-gray-400">Sin gastos fijos cargados.</p>
            ) : (
              fijos.map((g) => (
                <FilaGasto
                  key={g.id}
                  gasto={g}
                  pagos={pagosPorNombre[g.nombre]}
                  onPagar={setModalPago}
                  onEditar={(gasto) => setModalEdicion({ gasto })}
                />
              ))
            )}
          </div>

          <h2 className="mt-6 mb-1 font-heading text-sm font-semibold text-brand-brown">Gastos Variables</h2>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            {variables.length === 0 ? (
              <p className="px-3 py-3 text-sm text-gray-400">Sin gastos variables cargados.</p>
            ) : (
              variables.map((g) => (
                <FilaGasto
                  key={g.id}
                  gasto={g}
                  pagos={pagosPorNombre[g.nombre]}
                  onPagar={setModalPago}
                  onEditar={(gasto) => setModalEdicion({ gasto })}
                />
              ))
            )}
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-gray-400">
        Al marcar un pago, se carga como Gasto igual que siempre y, si la categoría está marcada "sale de la
        reserva", se descuenta de la reserva de Consultorio — automático, sin pasos extra.
      </p>

      {modalPago && (
        <RegistrarPagoRecurrenteModal
          gastoRecurrente={modalPago}
          categorias={categorias}
          onClose={() => setModalPago(null)}
          onGuardado={async () => {
            setModalPago(null);
            await recargar();
          }}
        />
      )}

      {(mostrarNuevo || modalEdicion) && (
        <GastoRecurrenteFormModal
          gastoRecurrente={modalEdicion?.gasto || null}
          categorias={categorias}
          onClose={() => {
            setMostrarNuevo(false);
            setModalEdicion(null);
          }}
          onGuardado={async () => {
            setMostrarNuevo(false);
            setModalEdicion(null);
            await recargar();
          }}
        />
      )}
    </main>
  );
}

export default function GastosRecurrentesPage() {
  return (
    <SoloDuena>
      <GastosRecurrentesContenido />
    </SoloDuena>
  );
}
