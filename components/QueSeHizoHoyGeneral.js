"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { calcularSugerenciaPago, obtenerPlanActivoPaciente } from "@/lib/data/caja";
import { actualizarEstadoTurnoGeneral } from "@/lib/data/turnosGeneral";
import {
  desmarcarPasoRealizado,
  marcarPasoPlanRealizado,
  marcarPrestacionAdHocRealizada,
  obtenerPasosDelPlan,
  obtenerPrestacionesAdHocPendientes,
  quitarPrestacionAdHocPendiente,
} from "@/lib/data/prestacionesRealizadas";

function pesos(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
}

// Se usa tanto en la Agenda normal (secretaria) como en "Ver Agenda del
// Día" (solo lectura) — es el mismo mecanismo en los dos lugares, para que
// no importe por dónde entre el profesional a marcar qué hizo.
//
// Es un paso a paso: 1) qué se hizo hoy (pasos del presupuesto, si tiene, y
// "algo aparte"), 2) qué se hace la próxima vez, 3) "Enviar a caja". Recién
// al enviar se guarda todo junto y le aparece a la secretaria para cobrar.
//
// `onTurnoActualizado` es opcional: si el que lo usa quiere mantener su
// propio estado del turno sincronizado (ej. para repintar la grilla), se le
// avisa acá cada vez que el turno pasa a "Finalizado".
export default function QueSeHizoHoyGeneral({ turno, fecha, profesionales, catalogo, onTurnoActualizado }) {
  const { perfil } = useAuth();
  // El saldo del plan y el atajo a Caja son para quien cobra: no se le muestran
  // al Odontólogo, Laboratorio ni Marketing.
  const puedeVerCobros = !["Odontologo", "Laboratorio", "CM"].includes(perfil?.rol);
  const [profesionalId, setProfesionalId] = useState(turno.profesionalDeTurnoId || "");
  const [planActivo, setPlanActivo] = useState(null);
  const [pasos, setPasos] = useState([]);
  const [adHocEnviados, setAdHocEnviados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [pasosElegidos, setPasosElegidos] = useState([]);
  const [aparte, setAparte] = useState([]);
  const [catalogoIdElegido, setCatalogoIdElegido] = useState("");
  const [cantidadElegida, setCantidadElegida] = useState(1);
  const [precioElegido, setPrecioElegido] = useState("");
  const [notaProximoTurno, setNotaProximoTurno] = useState("");
  const [cargoExtraDescripcion, setCargoExtraDescripcion] = useState("");
  const [cargoExtraMonto, setCargoExtraMonto] = useState("");
  const [proximaPrestacionCatalogoId, setProximaPrestacionCatalogoId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  async function recargar() {
    if (!turno.pacienteId) {
      setCargando(false);
      return;
    }
    const plan = await obtenerPlanActivoPaciente(turno.pacienteId);
    setPlanActivo(plan);
    const pendientes = await obtenerPrestacionesAdHocPendientes(turno.pacienteId);
    setAdHocEnviados(pendientes);
    if (plan) {
      const pasosPlan = await obtenerPasosDelPlan(plan.presupuesto_id);
      setPasos(pasosPlan);
    } else {
      setPasos([]);
    }
  }

  useEffect(() => {
    setCargando(true);
    recargar()
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turno.pacienteId]);

  // Marcar algo como hecho también cierra el turno (presencia:
  // "Finalizado") — así queda a la vista en la grilla de la Agenda sin
  // tener que ir a tildarlo aparte.
  async function marcarTurnoFinalizado() {
    if (turno.presencia === "Finalizado") return;
    const actualizado = await actualizarEstadoTurnoGeneral(turno.id, { presencia: "Finalizado" });
    onTurnoActualizado?.(actualizado);
  }

  function alternarPaso(nombre) {
    setMensaje(null);
    setPasosElegidos((actual) => (actual.includes(nombre) ? actual.filter((n) => n !== nombre) : [...actual, nombre]));
  }

  function elegirCatalogo(id) {
    setCatalogoIdElegido(id);
    // Con presupuesto activo, lo aparte se cobra como particular: viene el
    // precio de lista del catálogo, que se puede cambiar. Sin presupuesto el
    // precio queda vacío y Caja usa el del catálogo / copago de la obra social.
    const item = catalogo?.find((c) => c.id === id);
    setPrecioElegido(planActivo && item ? String(item.valor_lista ?? item.valor_efectivo ?? "") : "");
  }

  function agregarAparte() {
    const item = catalogo?.find((c) => c.id === catalogoIdElegido);
    if (!item) return;
    setMensaje(null);
    setAparte((actual) => [
      ...actual,
      {
        clave: `${Date.now()}-${actual.length}`,
        catalogoId: item.id,
        prestacion: item.prestacion,
        cantidad: Number(cantidadElegida) || 1,
        precio: precioElegido === "" ? null : Number(precioElegido),
      },
    ]);
    setCatalogoIdElegido("");
    setCantidadElegida(1);
    setPrecioElegido("");
  }

  async function deshacerPaso(realizadoId) {
    setError(null);
    setGuardando(true);
    try {
      await desmarcarPasoRealizado(realizadoId);
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function quitarEnviado(id) {
    setError(null);
    setGuardando(true);
    try {
      await quitarPrestacionAdHocPendiente(id);
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function enviarACaja() {
    setError(null);
    setMensaje(null);
    if (pasosElegidos.length === 0 && aparte.length === 0) {
      setError("Elegí qué hiciste hoy antes de enviar a caja.");
      return;
    }
    if (catalogo?.length > 0 && !proximaPrestacionCatalogoId) {
      setError("Elegí la prestación para el próximo turno (paso 2) antes de enviar a caja.");
      return;
    }
    setGuardando(true);
    try {
      const proximoItem = catalogo?.find((c) => c.id === proximaPrestacionCatalogoId);
      // La nota, el cargo extra y la próxima prestación son por visita, no
      // por cada cosa: se guardan en la primera y no se repiten.
      let primero = true;
      for (const nombre of pasosElegidos) {
        await marcarPasoPlanRealizado({
          presupuestoId: planActivo.presupuesto_id,
          prestacion: nombre,
          pacienteId: turno.pacienteId,
          profesionalId: profesionalId || null,
          turnoGeneralId: turno.id,
          notaProximoTurno: primero ? notaProximoTurno.trim() || null : null,
          cargoExtraDescripcion: primero ? cargoExtraDescripcion.trim() || null : null,
          cargoExtraMonto: primero && cargoExtraMonto ? Number(cargoExtraMonto) : null,
          proximaPrestacionCatalogoId: primero ? proximoItem?.id : undefined,
          proximaPrestacionNombre: primero ? proximoItem?.prestacion : undefined,
          fecha,
        });
        primero = false;
        setPasosElegidos((actual) => actual.filter((n) => n !== nombre));
      }
      for (const a of aparte) {
        await marcarPrestacionAdHocRealizada({
          catalogoId: a.catalogoId,
          prestacion: a.prestacion,
          cantidad: a.cantidad,
          precioManual: a.precio,
          pacienteId: turno.pacienteId,
          profesionalId: profesionalId || null,
          turnoGeneralId: turno.id,
          notaProximoTurno: primero ? notaProximoTurno.trim() || null : null,
          proximaPrestacionCatalogoId: primero ? proximoItem?.id : undefined,
          proximaPrestacionNombre: primero ? proximoItem?.prestacion : undefined,
          fecha,
        });
        primero = false;
        setAparte((actual) => actual.filter((x) => x.clave !== a.clave));
      }
      await marcarTurnoFinalizado();
      setNotaProximoTurno("");
      setCargoExtraDescripcion("");
      setCargoExtraMonto("");
      setProximaPrestacionCatalogoId("");
      await recargar();
      setMensaje("✓ Enviado a caja. La secretaria ya lo ve para cobrar.");
    } catch (e) {
      setError(e.message);
      recargar().catch(() => {});
    } finally {
      setGuardando(false);
    }
  }

  const pasosSinMarcar = pasos.filter((p) => !p.realizadoId && !p.cobrado && !pasosElegidos.includes(p.nombre));
  const sugerenciaPago = planActivo ? calcularSugerenciaPago(planActivo) : null;
  const linkCobrar = `/caja?pacienteId=${turno.pacienteId}&profesionalId=${profesionalId || ""}&abrir=1`;
  const cantidadAEnviar = pasosElegidos.length + aparte.length;
  const hayCatalogo = catalogo?.length > 0;

  if (!turno.pacienteId) return null;

  return (
    <div className="mt-4 border-t border-gray-200 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase text-brand-brown">Actividad de hoy</p>

      {profesionales?.length > 0 && (
        <label className="mb-2 flex flex-col gap-1 text-xs text-gray-600">
          Profesional que lo hizo
          <select
            value={profesionalId}
            onChange={(e) => setProfesionalId(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800"
          >
            <option value="">(sin asignar)</option>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && (
        <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">{error}</div>
      )}
      {mensaje && (
        <div className="mb-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-800">
          {mensaje}
        </div>
      )}

      {puedeVerCobros && !cargando && planActivo && sugerenciaPago && sugerenciaPago.pagoSugerido > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2">
          <p className="text-xs text-emerald-800">
            💰 Plan activo — {sugerenciaPago.numeroCuota === "Anticipo" ? "anticipo" : `cuota ${sugerenciaPago.numeroCuota}`}:{" "}
            <strong>{pesos(sugerenciaPago.pagoSugerido)}</strong> (saldo total: {pesos(planActivo.saldo_pendiente)})
          </p>
          <a
            href={linkCobrar}
            className="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
          >
            Cobrar ahora
          </a>
        </div>
      )}

      {cargando ? (
        <p className="text-xs text-gray-500">Buscando el plan de tratamiento...</p>
      ) : (
        <>
          <p className="mb-1 text-xs font-semibold text-gray-700">1. ¿Qué hiciste hoy?</p>

          {planActivo && (
            <div className="mb-3 rounded-md border border-gray-200 px-2.5 py-2">
              <p className="mb-1.5 text-[11px] font-semibold uppercase text-gray-400">Del presupuesto</p>
              {pasos.length === 0 ? (
                <p className="text-xs text-gray-500">El presupuesto de este paciente no tiene pasos cargados.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {pasos.map((paso, i) => (
                    <div key={`${paso.nombre}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
                      {paso.cobrado ? (
                        <span className="text-gray-400">
                          ✓ Paso {i + 1}: {paso.nombre} <span className="text-xs text-emerald-600">(ya cobrado)</span>
                        </span>
                      ) : paso.realizadoId ? (
                        <>
                          <span className="text-gray-700">
                            ✓ Paso {i + 1}: {paso.nombre}{" "}
                            <span className="text-xs text-amber-600">(enviado a caja, pendiente de cobro)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => deshacerPaso(paso.realizadoId)}
                            disabled={guardando}
                            className="text-xs text-gray-400 hover:text-red-600"
                          >
                            Deshacer
                          </button>
                        </>
                      ) : (
                        <label className="flex items-center gap-2 text-gray-700">
                          <input
                            type="checkbox"
                            checked={pasosElegidos.includes(paso.nombre)}
                            disabled={guardando}
                            onChange={() => alternarPaso(paso.nombre)}
                          />
                          Paso {i + 1}: {paso.nombre}
                        </label>
                      )}
                      {paso.cargoExtraMonto ? (
                        <span className="text-xs text-gray-500">
                          + {paso.cargoExtraDescripcion || "cargo extra"} ({pesos(paso.cargoExtraMonto)})
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-md border border-gray-200 px-2.5 py-2">
            <p className="mb-1.5 text-[11px] font-semibold uppercase text-gray-400">
              {planActivo ? "Algo aparte del presupuesto" : "Lo que hiciste"}
            </p>

            {(adHocEnviados.length > 0 || aparte.length > 0) && (
              <div className="mb-2 flex flex-col gap-1">
                {adHocEnviados.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-sm text-gray-700">
                    <span>
                      ✓ {p.prestacion}
                      {p.cantidad > 1 ? ` x${p.cantidad}` : ""}
                      {p.precio_manual ? ` — ${pesos(p.precio_manual)}` : ""}{" "}
                      <span className="text-xs text-amber-600">(enviado a caja, pendiente de cobro)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarEnviado(p.id)}
                      disabled={guardando}
                      className="text-xs text-gray-400 hover:text-red-600"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                {aparte.map((a) => (
                  <div key={a.clave} className="flex items-center justify-between gap-2 text-sm text-gray-700">
                    <span>
                      • {a.prestacion}
                      {a.cantidad > 1 ? ` x${a.cantidad}` : ""}
                      {a.precio !== null ? ` — ${pesos(a.precio)} c/u` : ""}{" "}
                      <span className="text-xs text-sky-600">(falta enviar)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAparte((actual) => actual.filter((x) => x.clave !== a.clave))}
                      disabled={guardando}
                      className="text-xs text-gray-400 hover:text-red-600"
                    >
                      Sacar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {hayCatalogo ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <select
                    value={catalogoIdElegido}
                    onChange={(e) => elegirCatalogo(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">(elegir prestación)</option>
                    {catalogo.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.prestacion}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={cantidadElegida}
                    onChange={(e) => setCantidadElegida(e.target.value)}
                    title="Cantidad"
                    className="w-14 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                {catalogoIdElegido && (
                  <input
                    type="number"
                    min={0}
                    value={precioElegido}
                    onChange={(e) => setPrecioElegido(e.target.value)}
                    placeholder={
                      !planActivo && turno.cobertura === "Particular"
                        ? `Vacío = precio del catálogo (${pesos(catalogo?.find((c) => c.id === catalogoIdElegido)?.valor_efectivo ?? 0)})`
                        : "Precio por unidad (opcional)"
                    }
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                )}
                {catalogoIdElegido && (
                  <p className="text-[11px] text-gray-400">
                    {planActivo
                      ? "Viene el precio de lista del catálogo — podés cambiarlo."
                      : turno.cobertura === "Particular"
                        ? "Dejalo vacío: se cobra el precio del catálogo. Solo completalo si querés cobrar otro monto."
                        : "Dejalo vacío para usar el precio del catálogo (o el de la obra social)."}
                  </p>
                )}
                <button
                  type="button"
                  onClick={agregarAparte}
                  disabled={!catalogoIdElegido || guardando}
                  className="self-start rounded-md border border-brand-brown/40 px-3 py-1 text-xs font-medium text-brand-brown hover:bg-brand-tan/30 disabled:opacity-50"
                >
                  + Agregar {planActivo ? "a la lista" : "a lo hecho"}
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-500">No hay catálogo de prestaciones para elegir.</p>
            )}
          </div>

          {planActivo && (
            <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
              <p className="mb-1 text-xs text-gray-600">Cargo extra (opcional, algo aparte del plan)</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={cargoExtraDescripcion}
                  onChange={(e) => setCargoExtraDescripcion(e.target.value)}
                  placeholder="Ej: Estudio radiográfico"
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={cargoExtraMonto}
                  onChange={(e) => setCargoExtraMonto(e.target.value)}
                  placeholder="Monto"
                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
            </div>
          )}

          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="mb-1 text-xs font-semibold text-gray-700">2. ¿Qué vas a realizar la próxima vez?</p>

            {hayCatalogo && (
              <label className="mb-2 flex flex-col gap-1 text-xs text-gray-600">
                Prestación para el próximo turno <span className="text-red-600">*</span>
                <select
                  value={proximaPrestacionCatalogoId}
                  onChange={(e) => setProximaPrestacionCatalogoId(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">(elegir prestación)</option>
                  {catalogo.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.prestacion}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-gray-400">
                  Obligatorio para poder enviar a caja. Cuando le den el próximo turno a este paciente, va a venir
                  pre-cargado con esto.
                </span>
              </label>
            )}

            {planActivo ? (
              pasosSinMarcar.length > 0 && (
                <label className="flex flex-col gap-1 text-xs text-gray-600">
                  ¿Cuál paso del presupuesto sigue? (opcional)
                  <select
                    value={notaProximoTurno}
                    onChange={(e) => setNotaProximoTurno(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">(no indicar)</option>
                    {pasosSinMarcar.map((p, i) => (
                      <option key={`${p.nombre}-${i}`} value={p.nombre}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              )
            ) : (
              <label className="flex flex-col gap-1 text-xs text-gray-600">
                Nota para el próximo turno (opcional)
                <textarea
                  value={notaProximoTurno}
                  onChange={(e) => setNotaProximoTurno(e.target.value)}
                  rows={2}
                  placeholder="Ej: continuar con el conducto"
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
            )}
          </div>

          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="mb-1 text-xs font-semibold text-gray-700">3. Enviar a caja</p>
            <button
              type="button"
              onClick={enviarACaja}
              disabled={guardando || cantidadAEnviar === 0}
              className="w-full rounded-md bg-brand-brown px-3 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando
                ? "Enviando..."
                : cantidadAEnviar > 0
                  ? `✓ Enviar a caja (${cantidadAEnviar} ${cantidadAEnviar === 1 ? "cosa" : "cosas"})`
                  : "✓ Enviar a caja"}
            </button>
            <p className="mt-1.5 text-xs text-gray-400">
              {cantidadAEnviar === 0
                ? "Elegí arriba qué hiciste hoy. Después tocá este botón y la secretaria lo ve para cobrar."
                : "Al enviar, le aparece a la secretaria para cobrar con el monto."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
