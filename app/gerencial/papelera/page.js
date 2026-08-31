"use client";

import { useEffect, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { eliminarDefinitivo, obtenerPapelera, restaurarDePapelera, vaciarPapeleraVieja } from "@/lib/data/papelera";

const DIAS_RETENCION = 30;

const ETIQUETAS_TABLA = {
  caja_general: "Cobro (Caja General)",
  caja_ortodoncia: "Cobro (Caja Ortodoncia)",
  facturacion_obras_sociales: "Ficha de Obra Social",
  pagos_asor: "Pago ASOR",
  remitos_asor: "Remito ASOR",
  facturacion_asor_pacientes: "Facturación ASOR por paciente",
  gastos: "Gasto",
  historial_clinico_entradas: "Entrada de historial clínico",
  configuracion_copago_excepcion: "Excepción de copago",
  pagos_profesionales: "Pago a profesional",
  pedidos_insumos: "Pedido de insumos",
  notas_credito_proveedores: "Nota de crédito de proveedor",
  planes_pagos_historicos: "Pago histórico de plan",
  disponibilidad_profesional: "Bloque de disponibilidad",
  stock_rodantes: "Rodante de stock",
  stock_insumos: "Insumo de stock",
  stock_movimientos: "Movimiento de stock",
  cierres_turno: "Cierre de turno",
  cierres_turno_ortodoncia: "Cierre de turno (Ortodoncia)",
  laboratorio_trabajos: "Trabajo de laboratorio",
  mecanicos_precios: "Precio de mecánico",
};

const CAMPOS_PREFERIDOS = [
  "nombre",
  "trabajo",
  "paciente_nombre",
  "tipo_trabajo",
  "nota",
  "concepto",
  "categoria",
  "motivo",
  "obra_social",
  "paciente",
  "proveedor_id",
  "insumo_id",
  "fecha",
  "monto",
  "importe",
  "total",
  "cantidad",
  "valor_os",
  "pendiente_liquidar",
];

function resumenGenerico(datos) {
  const partes = [];
  for (const campo of CAMPOS_PREFERIDOS) {
    const valor = datos[campo];
    if (valor === null || valor === undefined || valor === "") continue;
    partes.push(String(valor).slice(0, 80));
    if (partes.length >= 3) break;
  }
  return partes.length > 0 ? partes.join(" — ") : "(sin datos para mostrar)";
}

function diasRestantes(borradoEnISO) {
  const borrado = new Date(borradoEnISO);
  const limite = new Date(borrado);
  limite.setDate(limite.getDate() + DIAS_RETENCION);
  const dias = Math.ceil((limite - new Date()) / (1000 * 60 * 60 * 24));
  return dias;
}

function PapeleraContenido() {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtroTabla, setFiltroTabla] = useState("");
  const [procesando, setProcesando] = useState(null);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      await vaciarPapeleraVieja(DIAS_RETENCION);
      const data = await obtenerPapelera();
      setItems(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function restaurar(item) {
    setProcesando(item.id);
    setError(null);
    try {
      await restaurarDePapelera(item.id);
      setItems((its) => its.filter((i) => i.id !== item.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(null);
    }
  }

  async function borrarDefinitivo(item) {
    if (!window.confirm("¿Eliminar esto para siempre? No se va a poder recuperar.")) return;
    setProcesando(item.id);
    setError(null);
    try {
      await eliminarDefinitivo(item.id);
      setItems((its) => its.filter((i) => i.id !== item.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(null);
    }
  }

  const tablas = [...new Set(items.map((i) => i.tabla))].sort();
  const itemsFiltrados = items.filter((i) => !filtroTabla || i.tabla === filtroTabla);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🗑️ Papelera de reciclaje</h1>
      <p className="mt-1 text-sm text-gray-500">
        Todo lo que se borra en la app queda acá guardado por {DIAS_RETENCION} días antes de eliminarse para
        siempre — en ese tiempo se puede restaurar. Pasado ese plazo, se limpia solo.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <select
          value={filtroTabla}
          onChange={(e) => setFiltroTabla(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">Todo tipo de registros ({items.length})</option>
          {tablas.map((t) => (
            <option key={t} value={t}>
              {ETIQUETAS_TABLA[t] || t}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Tipo</th>
              <th className="px-3 py-2 text-left font-semibold">Resumen</th>
              <th className="px-3 py-2 text-left font-semibold">Borrado</th>
              <th className="px-3 py-2 text-left font-semibold">Días restantes</th>
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
            {!cargando && itemsFiltrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                  La papelera está vacía.
                </td>
              </tr>
            )}
            {itemsFiltrados.map((item) => {
              const dias = diasRestantes(item.borrado_en);
              return (
                <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-600">{ETIQUETAS_TABLA[item.tabla] || item.tabla}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{resumenGenerico(item.datos)}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {new Date(item.borrado_en).toLocaleString("es-AR")}
                  </td>
                  <td className={`px-3 py-2 ${dias <= 5 ? "text-red-600" : "text-gray-600"}`}>{dias}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => restaurar(item)}
                        disabled={procesando === item.id}
                        className="text-xs font-medium text-brand-brown hover:underline disabled:opacity-50"
                      >
                        Restaurar
                      </button>
                      <button
                        onClick={() => borrarDefinitivo(item)}
                        disabled={procesando === item.id}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        Borrar para siempre
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function PapeleraPage() {
  return (
    <SoloDuena>
      <PapeleraContenido />
    </SoloDuena>
  );
}
