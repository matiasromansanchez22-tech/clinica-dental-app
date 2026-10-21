"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SoloDuenaYContador from "@/components/SoloDuenaYContador";
import { useAuth } from "@/lib/auth/AuthProvider";
import { marcarComoRevisado, obtenerAlertas } from "@/lib/data/queRevisar";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function formatoFecha(fechaISO) {
  const [, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}`;
}

function formatoPesos(n) {
  const r = Math.round(n);
  return `${r < 0 ? "-" : ""}$${Math.abs(r).toLocaleString("es-AR")}`;
}

function Seccion({ titulo, cantidad, ayuda, children }) {
  return (
    <section className="mt-6 rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2">
        <h2 className="font-heading text-sm font-semibold text-brand-charcoal">{titulo}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cantidad > 0 ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
          {cantidad > 0 ? cantidad : "OK"}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">{ayuda}</p>
      {cantidad > 0 && <div className="mt-3 flex flex-col gap-2">{children}</div>}
    </section>
  );
}

function BotonRevisado({ onClick, texto }) {
  return (
    <button onClick={onClick} className="shrink-0 rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
      {texto}
    </button>
  );
}

function LineaPago({ p }) {
  return (
    <span className="block text-sm text-gray-800">
      {p.etiqueta} — <strong>{formatoPesos(p.monto)}</strong> el {formatoFecha(p.fecha)} ({p.medioPago})
    </span>
  );
}

function QueRevisarContenido() {
  const { perfil } = useAuth();
  const puedeMarcar = perfil?.rol === "Duena";
  const [alertas, setAlertas] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activo = true;
    obtenerAlertas()
      .then((a) => activo && setAlertas(a))
      .catch((e) => activo && setError(e.message));
    return () => {
      activo = false;
    };
  }, []);

  async function revisar(clave, tipo, pregunta, quitar) {
    const nota = window.prompt(pregunta);
    if (nota === null) return;
    try {
      await marcarComoRevisado({ clave, tipo, nota });
      setAlertas((a) => quitar({ ...a, total: a.total - 1 }));
    } catch (e) {
      setError(e.message.includes("revisiones_control") ? "Falta correr la migración 166 en Supabase." : e.message);
    }
  }

  const cc = alertas?.controlCobros;
  const cobrosPorRevisar = cc ? cc.deMenos + cc.cobroSinVisita + cc.deMasSinExplicar : 0;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🔎 Qué revisar</h1>
      <p className="mt-1 text-sm text-gray-500">
        Todo lo raro que puede significar un error de carga, en una sola lista. Si algo está bien, marcalo como revisado con una nota y no vuelve a aparecer.
      </p>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {!alertas && !error && <p className="mt-6 text-sm text-gray-500">Revisando...</p>}

      {alertas && (
        <>
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${
              alertas.total === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"
            }`}
          >
            {alertas.total === 0 ? "✅ No hay nada para revisar." : `Hay ${alertas.total} cosa${alertas.total === 1 ? "" : "s"} para revisar.`}
          </div>

          <Seccion
            titulo="Posibles pagos cargados dos veces"
            cantidad={alertas.duplicados.length}
            ayuda="Mismo monto, misma persona y dentro de una semana (últimos 30 días). Si fue un solo pago, borrá uno desde el Historial de pagos o Gastos."
          >
            {alertas.duplicados.map((d) => (
              <div key={d.clave} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <div>
                  <LineaPago p={d.a} />
                  <LineaPago p={d.b} />
                </div>
                {puedeMarcar && (
                  <BotonRevisado
                    texto="Son dos pagos distintos"
                    onClick={() =>
                      revisar(d.clave, "duplicado", "¿Por qué son dos pagos distintos? (opcional)", (a) => ({
                        ...a,
                        duplicados: a.duplicados.filter((x) => x.clave !== d.clave),
                      }))
                    }
                  />
                )}
              </div>
            ))}
            <Link href="/gerencial/historial-pagos" className="text-xs text-brand-brown underline">
              Ir al Historial de pagos
            </Link>
          </Seccion>

          <Seccion
            titulo="Pacientes de Ortodoncia que vinieron y no figura el cobro"
            cantidad={alertas.sinCobro.length}
            ayuda="Vinieron en los últimos 30 días y no tienen ningún cobro cargado ese mes (ni pago anticipado). Si no pagaban esa visita, marcalo como revisado con el motivo."
          >
            {alertas.sinCobro.map((f) => (
              <div key={f.clave} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium text-gray-900">{f.paciente}</span>
                  <span className="text-gray-500"> · {f.ortodoncista}</span>
                  <span className="block text-xs text-gray-600">
                    {f.turnos.map((t) => `${formatoFecha(t.fecha)} ${t.concepto}`).join(" · ")} ({MESES[Number(f.mes.slice(5)) - 1]})
                  </span>
                  {f.grilla && <span className="block text-xs font-medium text-amber-700">La grilla de Controles dice «{f.grilla}» pero no hay cobro en caja.</span>}
                </div>
                {puedeMarcar && (
                  <BotonRevisado
                    texto="Revisado"
                    onClick={() =>
                      revisar(f.clave, "sin_cobro", `¿Por qué ${f.paciente} no tiene cobro? (ej. pagó antes, no se cobra esta visita)`, (a) => ({
                        ...a,
                        sinCobro: a.sinCobro.filter((x) => x.clave !== f.clave),
                      }))
                    }
                  />
                )}
              </div>
            ))}
            <Link href="/ortodoncia/caja" className="text-xs text-brand-brown underline">
              Ir a la Caja de Ortodoncia
            </Link>
          </Seccion>

          <Seccion
            titulo="Pagos con la reserva cargados por la contadora"
            cantidad={alertas.reservaContadora.length}
            ayuda="Confirmá que salieron de la reserva. Si en realidad se pagaron con la plata del mes, el Balance Mensual no los está restando: borralo y pedile que lo cargue de nuevo sin tildar la reserva."
          >
            {alertas.reservaContadora.map((g) => (
              <div key={g.clave} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <span className="text-sm text-gray-800">
                  {g.descripcion || g.categoria} — <strong>{formatoPesos(g.monto)}</strong> el {formatoFecha(g.fecha)} ({g.medioPago}) · cargó {g.cargadoPor}
                </span>
                {puedeMarcar && (
                  <BotonRevisado
                    texto="Sí, salió de la reserva"
                    onClick={() =>
                      revisar(g.clave, "reserva_contadora", "Nota (opcional)", (a) => ({
                        ...a,
                        reservaContadora: a.reservaContadora.filter((x) => x.clave !== g.clave),
                      }))
                    }
                  />
                )}
              </div>
            ))}
            <Link href="/gerencial/gastos" className="text-xs text-brand-brown underline">
              Ir a Gastos
            </Link>
          </Seccion>

          <Seccion
            titulo="Cuentas sin saldo real al día"
            cantidad={alertas.cuentas.length}
            ayuda="Anotá el saldo real de Galicia y Mercado Pago al menos una vez por semana: así cualquier diferencia se encuentra en días y no a fin de mes."
          >
            {alertas.cuentas.map((c) => (
              <p key={c.cuenta} className="text-sm text-gray-800">
                <strong>{c.cuenta}:</strong> {c.ultimo ? `último saldo real hace ${c.dias} días (${formatoFecha(c.ultimo)})` : "todavía no tiene ningún saldo real anotado"}.
              </p>
            ))}
            <Link href="/gerencial/cuentas" className="text-xs text-brand-brown underline">
              Ir a Cuentas
            </Link>
          </Seccion>

          <Seccion
            titulo="Reserva del Consultorio en negativo"
            cantidad={alertas.reservas.length}
            ayuda="Se pagó con la reserva más de lo que tenía cargado. Suele ser un saldo inicial desactualizado o un pago cargado con la reserva por error."
          >
            {alertas.reservas.map((r) => (
              <p key={r.cuenta} className="text-sm text-gray-800">
                <strong>{r.cuenta}:</strong> {formatoPesos(r.saldo)}
              </p>
            ))}
            <Link href="/gerencial/finanzas-personales" className="text-xs text-brand-brown underline">
              Ir a Consultorio
            </Link>
          </Seccion>

          {cc && (
            <Seccion
              titulo="Cobros de Ortodoncia con diferencias este mes"
              cantidad={cobrosPorRevisar}
              ayuda="Cobrado de menos, cobrado de más sin explicar o cobros sin visita. El detalle está en el Control de cobros."
            >
              <p className="text-sm text-gray-800">
                {cc.deMenos} cobrado de menos · {cc.deMasSinExplicar} cobrado de más sin explicar · {cc.cobroSinVisita} cobro sin visita registrada.
              </p>
              <Link href="/gerencial/seguimiento-ortodoncia" className="text-xs text-brand-brown underline">
                Ir al Seguimiento de Ortodoncia → Control de cobros
              </Link>
            </Seccion>
          )}
        </>
      )}
    </main>
  );
}

export default function QueRevisarPage() {
  return (
    <SoloDuenaYContador>
      <QueRevisarContenido />
    </SoloDuenaYContador>
  );
}
