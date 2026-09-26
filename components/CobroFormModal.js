"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  calcularSugerenciaPago,
  crearCobro,
  obtenerPlanActivoPaciente,
  obtenerPrestacionesDelPresupuesto,
  obtenerPrestacionesObraSocial,
  obtenerPrestacionesParticular,
} from "@/lib/data/caja";
import { marcarPendientesComoCobrados, obtenerPendientesDeCobro } from "@/lib/data/prestacionesRealizadas";
import { aplicarSaldoAFavor, obtenerSaldoAFavor } from "@/lib/data/saldosAFavor";

const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR"];
const MAX_PRESTACIONES = 3;

function filaVacia() {
  return { itemId: "", prestacion: "", codigo: "", cantidad: 1, valor: 0, valorOS: 0, sinHonorarios: false };
}

function parteVacia(medio) {
  return { medio, monto: "" };
}

export default function CobroFormModal({
  fecha,
  pacientes,
  profesionales,
  pacienteIdInicial,
  profesionalIdInicial,
  onClose,
  onCreado,
}) {
  const [pacienteId, setPacienteId] = useState(pacienteIdInicial || "");
  const [profesionalAtencionId, setProfesionalAtencionId] = useState(profesionalIdInicial || "");
  // No resetear el profesional mientras el paciente no cambió realmente —
  // si vino elegido desde el aviso de Agenda (junto con el paciente), se
  // respeta esa selección; recién cuando el secretario elige OTRO paciente
  // a mano se vuelve a limpiar, como siempre. Comparar contra el paciente
  // anterior (en vez de una bandera "primera vez") lo hace a prueba de que
  // el efecto se dispare dos veces en desarrollo (React Strict Mode).
  const pacienteIdAnterior = useRef(pacienteId);
  const [planActivo, setPlanActivo] = useState(null);
  const [cargandoPlan, setCargandoPlan] = useState(false);
  const [cobroIndependienteDelPlan, setCobroIndependienteDelPlan] = useState(false);
  const [cobroComoParticular, setCobroComoParticular] = useState(false);
  const primerCatalogoCargado = useRef(false);
  const [prestacionesDelPlan, setPrestacionesDelPlan] = useState([]);
  const [prestacionesRealizadas, setPrestacionesRealizadas] = useState([]);
  const [pendientesIds, setPendientesIds] = useState([]);
  // Solo para Obra Social sin plan: lo que el profesional marcó en Agenda
  // no se puede pre-cargar en la fila (el catálogo de acá es el de
  // particular, no el nomenclador), así que se avisa en texto para que
  // se agregue a mano — igual se cierra el pendiente al cobrar.
  const [pendientesObraSocialSinPrecargar, setPendientesObraSocialSinPrecargar] = useState([]);
  const [prestacionesDisponibles, setPrestacionesDisponibles] = useState([]);
  const [prestaciones, setPrestaciones] = useState([filaVacia()]);
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [pagoMixto, setPagoMixto] = useState(false);
  const [desglosePago, setDesglosePago] = useState([parteVacia("Efectivo"), parteVacia("Transferencia")]);
  const [pago, setPago] = useState(0);
  const [numeroCuota, setNumeroCuota] = useState("");
  const [precioAnterior, setPrecioAnterior] = useState(false);
  const [cargoExtraPlan, setCargoExtraPlan] = useState(null);
  const [saldoAFavor, setSaldoAFavor] = useState(0);
  const [montoAFavorAplicado, setMontoAFavorAplicado] = useState(0);
  const [montoAAplicarInput, setMontoAAplicarInput] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const paciente = pacientes.find((p) => p.id === pacienteId);
  const esObraSocial = paciente?.tipo_paciente === "Obra Social" || paciente?.tipo_paciente === "Mixto";
  const usaPlan = Boolean(planActivo) && !cobroIndependienteDelPlan;
  // Un paciente registrado como Obra Social (o Mixto) a veces viene a
  // hacerse algo puntual que paga particular (para poder cobrar el valor
  // particular en vez del de la obra social) — este check no toca el
  // registro del paciente, solo hace que ESTE cobro use el catálogo y el
  // precio de particular.
  const esObraSocialEfectivo = esObraSocial && !cobroComoParticular;

  useEffect(() => {
    if (!paciente) {
      setPlanActivo(null);
      setPrestacionesDisponibles([]);
      setPendientesIds([]);
      return;
    }
    if (pacienteIdAnterior.current !== pacienteId) setProfesionalAtencionId("");
    pacienteIdAnterior.current = pacienteId;
    setCobroIndependienteDelPlan(false);
    setCobroComoParticular(false);
    primerCatalogoCargado.current = false;
    setPrestacionesDelPlan([]);
    setPrestacionesRealizadas([]);
    setPendientesIds([]);
    setPendientesObraSocialSinPrecargar([]);
    setPrestaciones([filaVacia()]);
    setCargoExtraPlan(null);
    setSaldoAFavor(0);
    setMontoAFavorAplicado(0);
    setMontoAAplicarInput("");
    setCargandoPlan(true);

    // Lo que el profesional ya marcó como "hecho" en la Agenda para este
    // paciente — viene pre-cargado acá en vez de arrancar de cero.
    const promesaPendientes = obtenerPendientesDeCobro(paciente.id);
    obtenerSaldoAFavor(paciente.id, false)
      .then(setSaldoAFavor)
      .catch(() => {});

    obtenerPlanActivoPaciente(paciente.id)
      .then((plan) => {
        setPlanActivo(plan);
        if (plan) {
          const { pagoSugerido, numeroCuota: cuota } = calcularSugerenciaPago(plan);
          setPago(pagoSugerido);
          setNumeroCuota(String(cuota));
          obtenerPrestacionesDelPresupuesto(plan.presupuesto_id).then(setPrestacionesDelPlan);
          promesaPendientes.then((pendientes) => {
            if (pendientes.plan.length > 0) {
              setPrestacionesRealizadas(pendientes.plan.map((p) => p.nombre));
              setPendientesIds(pendientes.plan.map((p) => p.id));
              // Algo aparte del plan que el profesional marcó al lado de un
              // paso (ej. un estudio) — se suma a la cuota sugerida de arriba.
              const conCargoExtra = pendientes.plan.find((p) => p.cargoExtraMonto);
              if (conCargoExtra) {
                setCargoExtraPlan({
                  descripcion: conCargoExtra.cargoExtraDescripcion,
                  monto: Number(conCargoExtra.cargoExtraMonto),
                });
                // Se suma sobre la cuota sugerida (no sobre "pago" actual) para
                // que sea a prueba de que este efecto se dispare dos veces en
                // desarrollo (React Strict Mode) sin duplicar el extra.
                setPago(pagoSugerido + Number(conCargoExtra.cargoExtraMonto));
              }
              const conNota = pendientes.plan.find((p) => p.notaProximoTurno);
              if (conNota) {
                setObservaciones((actual) => actual || `Nota del profesional: ${conNota.notaProximoTurno}`);
              }
            }
          });
        }
      })
      .finally(() => setCargandoPlan(false));

    const promesaCatalogo =
      esObraSocial && paciente.obra_social
        ? obtenerPrestacionesObraSocial(paciente.obra_social)
        : obtenerPrestacionesParticular();
    promesaCatalogo.then((disponibles) => {
      setPrestacionesDisponibles(disponibles);
      primerCatalogoCargado.current = true;
      promesaPendientes.then((pendientes) => {
        if (pendientes.adHoc.length === 0) return;
        // Esto se cierra siempre, sea Particular u Obra Social — si no,
        // para un paciente de Obra Social sin plan lo marcado en Agenda
        // nunca se limpiaba (el catálogo de acá abajo es el de particular,
        // no le sirve al nomenclador de obra social, así que antes ni
        // siquiera se intentaba tocar el pendiente) y la nube de "listo
        // para cobrar" le quedaba pegada para siempre aunque ya le hubieran
        // cobrado.
        setPendientesIds((actual) => [...actual, ...pendientes.adHoc.map((p) => p.id)]);
        const conNota = pendientes.adHoc.find((p) => p.notaProximoTurno);
        if (conNota) {
          setObservaciones((actual) => actual || `Nota del profesional: ${conNota.notaProximoTurno}`);
        }
        // Pre-completar las filas de "A qué viene" con el catálogo de acá
        // solo tiene sentido para particulares — el catálogo que se usa
        // acá es el de particular, no el nomenclador de obra social.
        if (esObraSocial) {
          setPendientesObraSocialSinPrecargar(pendientes.adHoc.map((p) => p.prestacion));
          return;
        }
        const filas = pendientes.adHoc
          .map((p) => {
            const item = disponibles.find((d) => d.id === p.catalogoId);
            if (!item) return null;
            return {
              itemId: item.id,
              prestacion: item.prestacion,
              codigo: item.codigo || "",
              cantidad: p.cantidad || 1,
              // Si el profesional marcó un precio distinto en Agenda, se
              // respeta ese en vez del de lista/efectivo del catálogo —
              // "esManual" evita que el efecto de abajo (que recalcula al
              // cambiar el medio de pago) se lo pise.
              valor: p.precioManual ?? item.valor_efectivo ?? item.valor_lista ?? 0,
              valorOS: 0,
              sinHonorarios: item.prestacion === "Estampilla",
              especialidad: item.especialidad || null,
              esManual: Boolean(p.precioManual),
            };
          })
          .filter(Boolean);
        if (filas.length > 0) setPrestaciones(filas);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  // Al tildar/destildar "cobrar como particular" se cambia de catálogo
  // (nomenclador ↔ particular) — se ignora la primera vez que corre (ya
  // lo cargó el efecto de arriba al elegir el paciente).
  useEffect(() => {
    if (!paciente) return;
    if (!primerCatalogoCargado.current) return;
    const promesaCatalogo =
      esObraSocialEfectivo && paciente.obra_social
        ? obtenerPrestacionesObraSocial(paciente.obra_social)
        : obtenerPrestacionesParticular();
    promesaCatalogo.then(setPrestacionesDisponibles);
    setPrestaciones([filaVacia()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobroComoParticular]);

  function calcularValor(item) {
    if (!item) return { valor: 0, valorOS: 0 };
    if (esObraSocialEfectivo) {
      return { valor: Number(item.copago_oficial) || 0, valorOS: Number(item.valor_os) || 0 };
    }
    // Con pago mixto no hay un único medio para decidir el precio — se usa
    // el de Lista (el mismo que Transferencia/tarjeta) en vez de asumir que
    // le corresponde el descuento de Efectivo.
    const valor = !pagoMixto && medioPago === "Efectivo" ? item.valor_efectivo : item.valor_lista;
    return { valor: Number(valor) || 0, valorOS: 0 };
  }

  function actualizarFila(indice, cambios) {
    setPrestaciones((filas) => {
      const nuevas = [...filas];
      const fila = { ...nuevas[indice], ...cambios };
      if ("itemId" in cambios) {
        const item = prestacionesDisponibles.find((p) => p.id === cambios.itemId);
        const { valor, valorOS } = calcularValor(item);
        fila.prestacion = item ? (esObraSocialEfectivo ? item.prestacion_os : item.prestacion) : "";
        fila.codigo = item?.codigo || "";
        fila.valor = valor;
        fila.valorOS = valorOS;
        // Especialidad del catálogo (solo particular por ahora) — para que
        // Producción pueda liquidar un % distinto según la especialidad de
        // la prestación, no solo un % fijo por profesional.
        fila.especialidad = item?.especialidad || null;
        // Categoría del nomenclador (solo obra social) — para poder separar,
        // ej., lo que ASOR liquida como "Prótesis" de las prestaciones comunes.
        fila.categoria = item?.categoria || null;
        // Prestaciones administrativas conocidas (no le corresponden % a
        // ningún profesional) se marcan solas al elegirlas — se puede
        // destildar a mano si hiciera falta.
        fila.sinHonorarios = fila.prestacion === "Estampilla";
      }
      nuevas[indice] = fila;
      return nuevas;
    });
  }

  // Si cambia el medio de pago (o se activa/desactiva el mixto), recalcular
  // los valores de particulares (Lista/Efectivo) — salvo las filas con
  // precio manual (marcado como distinto desde Agenda), esas no se tocan.
  useEffect(() => {
    if (esObraSocialEfectivo) return;
    setPrestaciones((filas) =>
      filas.map((f) => {
        if (!f.itemId || f.esManual) return f;
        const item = prestacionesDisponibles.find((p) => p.id === f.itemId);
        const { valor } = calcularValor(item);
        return { ...f, valor };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medioPago, pagoMixto]);

  const totalDesglosado = desglosePago.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

  // Con pago mixto, el importe a cobrar sigue siempre la suma del
  // desglose — no tiene sentido que se puedan desincronizar.
  useEffect(() => {
    if (pagoMixto) setPago(totalDesglosado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagoMixto, totalDesglosado]);

  function actualizarParte(i, cambios) {
    setDesglosePago((partes) => partes.map((p, idx) => (idx === i ? { ...p, ...cambios } : p)));
  }

  function agregarParte() {
    const usados = new Set(desglosePago.map((p) => p.medio));
    const disponible = MEDIOS_PAGO.find((m) => !usados.has(m)) || MEDIOS_PAGO[0];
    setDesglosePago((partes) => [...partes, parteVacia(disponible)]);
  }

  function quitarParte(i) {
    setDesglosePago((partes) => partes.filter((_, idx) => idx !== i));
  }

  const importeTotal = useMemo(
    () => prestaciones.reduce((acc, f) => acc + (f.itemId ? Number(f.valor) * Number(f.cantidad) : 0), 0),
    [prestaciones]
  );

  useEffect(() => {
    if (!usaPlan) setPago(importeTotal);
  }, [importeTotal, usaPlan]);

  function agregarFila() {
    if (prestaciones.length >= MAX_PRESTACIONES) return;
    setPrestaciones((f) => [...f, filaVacia()]);
  }

  function quitarFila(indice) {
    setPrestaciones((f) => f.filter((_, i) => i !== indice));
  }

  function alternarPrestacionRealizada(nombre) {
    setPrestacionesRealizadas((actual) =>
      actual.includes(nombre) ? actual.filter((p) => p !== nombre) : [...actual, nombre]
    );
  }

  function aplicarSaldo() {
    const sugerido = Math.min(saldoAFavor, Number(pago));
    const elegido = montoAAplicarInput === "" ? sugerido : Number(montoAAplicarInput) || 0;
    const monto = Math.min(elegido, saldoAFavor, Number(pago));
    if (monto <= 0) return;
    setPago((actual) => Number(actual) - monto);
    setMontoAFavorAplicado(monto);
    setMontoAAplicarInput("");
  }

  function quitarSaldoAplicado() {
    setPago((actual) => Number(actual) + montoAFavorAplicado);
    setMontoAFavorAplicado(0);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!pacienteId) {
      setError("Falta elegir el paciente.");
      return;
    }
    if (!profesionalAtencionId) {
      setError("Falta elegir el profesional que atendió.");
      return;
    }
    if (!usaPlan && prestaciones.every((p) => !p.itemId)) {
      setError("Agregá al menos una prestación.");
      return;
    }
    if (pagoMixto) {
      if (desglosePago.some((p) => !p.medio || !p.monto || Number(p.monto) <= 0)) {
        setError("Completá el medio y el monto de cada parte del pago mixto.");
        return;
      }
      const mediosRepetidos = new Set(desglosePago.map((p) => p.medio)).size !== desglosePago.length;
      if (mediosRepetidos) {
        setError("No repitas el mismo medio de pago dos veces — sumalo en una sola parte.");
        return;
      }
    }

    setGuardando(true);
    try {
      const observacionesFinal = [
        observaciones || null,
        cargoExtraPlan ? `Cargo extra: ${cargoExtraPlan.descripcion || "(sin descripción)"} ($${Number(cargoExtraPlan.monto).toLocaleString("es-AR")})` : null,
        cobroComoParticular ? `Paciente de ${paciente.obra_social || "obra social"} — esta prestación se cobró como particular.` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      const caja = await crearCobro({
        fecha,
        tipo: esObraSocialEfectivo ? "Obra Social" : "Particular",
        cobertura: esObraSocialEfectivo ? paciente.obra_social : "Particular",
        pacienteId,
        dni: paciente.dni,
        numeroAfiliado: paciente.numero_afiliado,
        profesionalResponsableId: paciente.profesional_responsable_id || null,
        profesionalAtencionId: profesionalAtencionId || null,
        modalidad: usaPlan ? "Plan de financiación" : "Día a día",
        numeroCuota: usaPlan ? numeroCuota : null,
        prestaciones: usaPlan
          ? []
          : prestaciones
              .filter((p) => p.itemId)
              .map((p) => ({
                prestacion: p.prestacion,
                codigo: p.codigo,
                cantidad: p.cantidad,
                valor: p.valor,
                valorOS: p.valorOS,
                sinHonorarios: p.sinHonorarios,
                especialidad: p.especialidad || null,
                categoria: p.categoria || null,
              })),
        importeTotal: usaPlan ? Number(pago) : importeTotal,
        pago: Number(pago),
        medioPago,
        desglosePago: pagoMixto ? desglosePago.map((p) => ({ medio: p.medio, monto: Number(p.monto) })) : null,
        // Si se cargaron las prestaciones completas (para liquidar bien al
        // profesional) pero el paciente pagó menos, queda anotada la
        // diferencia para no perderla de vista — lo que se cubrió con saldo
        // a favor no cuenta como "todavía debe", por eso se suma de vuelta
        // antes de comparar.
        saldoPendiente:
          !usaPlan && Number(pago) + montoAFavorAplicado < importeTotal
            ? importeTotal - Number(pago) - montoAFavorAplicado
            : null,
        idDocumento: usaPlan ? planActivo.numero_plan : null,
        tipoDocumento: usaPlan ? "Plan de financiación" : null,
        precioAnterior,
        observaciones: observacionesFinal || null,
        prestacionesRealizadas: usaPlan ? prestacionesRealizadas : [],
      });
      if (pendientesIds.length > 0) await marcarPendientesComoCobrados(pendientesIds, caja.id);
      if (montoAFavorAplicado > 0) {
        await aplicarSaldoAFavor({
          pacienteId,
          esOrtodoncia: false,
          monto: montoAFavorAplicado,
          cajaGeneralId: caja.id,
          fecha,
        });
      }
      onCreado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Nuevo cobro</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Paciente
            <select
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              <option value="">Elegí un paciente...</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.apellido_y_nombre}
                </option>
              ))}
            </select>
          </label>

          {paciente && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Cobertura: </span>
                {esObraSocial ? paciente.obra_social : "Particular"}
              </div>
              <label className="flex flex-col gap-1 text-gray-700">
                Profesional que atendió
                <select
                  value={profesionalAtencionId}
                  onChange={(e) => setProfesionalAtencionId(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                >
                  <option value="">Elegí quién atendió...</option>
                  {profesionales.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.nombre}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-400">
                  Profesional habitual: {paciente.profesional_responsable?.nombre || "—"}
                </span>
              </label>
            </div>
          )}

          {esObraSocial && (
            <label className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
              <input
                type="checkbox"
                checked={cobroComoParticular}
                onChange={(e) => setCobroComoParticular(e.target.checked)}
              />
              Cobrar esta prestación como particular (no por la obra social)
            </label>
          )}

          {cargandoPlan && <p className="text-sm text-gray-500">Buscando plan de financiación activo...</p>}

          {pendientesIds.length > 0 && pendientesObraSocialSinPrecargar.length === 0 && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ✓ Ya viene pre-cargado con lo que el profesional marcó en Agenda — revisá y confirmá.
              {cargoExtraPlan && (
                <>
                  {" "}
                  También cargó un extra: {cargoExtraPlan.descripcion || "cargo extra"} ($
                  {Number(cargoExtraPlan.monto).toLocaleString("es-AR")}) — ya viene sumado al pago.
                </>
              )}
            </p>
          )}

          {pendientesObraSocialSinPrecargar.length > 0 && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ✓ El profesional marcó en Agenda: {pendientesObraSocialSinPrecargar.join(", ")}. No se pudo
              pre-cargar la fila porque es de Obra Social — agregala a mano abajo con el código del nomenclador
              que corresponda.
            </p>
          )}

          {planActivo && (
            <div className="rounded-md border border-brand-mint/40 bg-brand-mint/15 px-3 py-2 text-sm text-brand-green">
              <p>
                Tiene un plan activo <strong>{planActivo.numero_plan}</strong>. Saldo pendiente actual: $
                {Number(planActivo.saldo_pendiente).toLocaleString("es-AR")}.
              </p>
              {usaPlan && (
                <p className="mt-1">
                  Este cobro se va a aplicar a{" "}
                  <strong>{numeroCuota === "Anticipo" ? "el anticipo" : `la cuota ${numeroCuota}`}</strong>.
                </p>
              )}
              <label className="mt-2 flex items-center gap-2 text-brand-green">
                <input
                  type="checkbox"
                  checked={cobroIndependienteDelPlan}
                  onChange={(e) => setCobroIndependienteDelPlan(e.target.checked)}
                />
                Este pago es por otro tratamiento, no es una cuota del plan
              </label>
            </div>
          )}

          {usaPlan && prestacionesDelPlan.length > 0 && (
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="mb-1.5 text-xs font-semibold uppercase text-gray-400">
                ¿Qué se hizo hoy? (opcional, solo para el registro)
              </p>
              <div className="flex flex-col gap-1">
                {prestacionesDelPlan.map((nombre) => (
                  <label key={nombre} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={prestacionesRealizadas.includes(nombre)}
                      onChange={() => alternarPrestacionRealizada(nombre)}
                    />
                    {nombre}
                  </label>
                ))}
              </div>
            </div>
          )}

          {paciente && !usaPlan && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-gray-400">
                  Prestaciones (hasta {MAX_PRESTACIONES})
                </p>
                {prestaciones.length < MAX_PRESTACIONES && (
                  <button type="button" onClick={agregarFila} className="text-xs text-blue-600 hover:underline">
                    + Agregar
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {prestaciones.map((fila, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      {esObraSocialEfectivo && (
                        <input
                          type="text"
                          placeholder="Código"
                          title="Escribí el código que te pasó el profesional y se elige sola la prestación"
                          onChange={(e) => {
                            const codigo = e.target.value.trim();
                            if (!codigo) return;
                            const item = prestacionesDisponibles.find((p) => p.codigo === codigo);
                            if (item) {
                              actualizarFila(i, { itemId: item.id });
                              e.target.value = "";
                            }
                          }}
                          className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      )}
                      <select
                        value={fila.itemId}
                        onChange={(e) => actualizarFila(i, { itemId: e.target.value })}
                        className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">(elegir prestación)</option>
                        {prestacionesDisponibles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {esObraSocialEfectivo ? p.prestacion_os : p.prestacion}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={fila.cantidad}
                        onChange={(e) => actualizarFila(i, { cantidad: Number(e.target.value) })}
                        className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                      <input
                        type="number"
                        min={0}
                        value={fila.valor}
                        onChange={(e) => actualizarFila(i, { valor: Number(e.target.value) })}
                        title="El sistema sugiere el valor de catálogo — se puede ajustar si hace falta"
                        className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-right text-sm"
                      />
                      <button type="button" onClick={() => quitarFila(i)} className="text-gray-400 hover:text-red-600">
                        ✕
                      </button>
                    </div>
                    {fila.itemId && (
                      <label className="flex items-center gap-1.5 pl-1 text-xs text-gray-500">
                        <input
                          type="checkbox"
                          checked={fila.sinHonorarios}
                          onChange={(e) => actualizarFila(i, { sinHonorarios: e.target.checked })}
                        />
                        Sin honorarios (no le genera % a nadie — ej. estampilla, consulta administrativa)
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={pagoMixto} onChange={(e) => setPagoMixto(e.target.checked)} />
            Pago mixto (más de un medio de pago)
          </label>

          {pagoMixto ? (
            <div className="flex flex-col gap-2">
              {desglosePago.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={p.medio}
                    onChange={(e) => actualizarParte(i, { medio: e.target.value })}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {MEDIOS_PAGO.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={p.monto}
                    onChange={(e) => actualizarParte(i, { monto: e.target.value })}
                    placeholder="Monto"
                    className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-right text-sm"
                  />
                  {desglosePago.length > 1 && (
                    <button type="button" onClick={() => quitarParte(i)} className="text-gray-400 hover:text-red-600">
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {desglosePago.length < MEDIOS_PAGO.length && (
                <button type="button" onClick={agregarParte} className="w-fit text-xs text-blue-600 hover:underline">
                  + Agregar otro medio
                </button>
              )}
              <p className="text-right text-sm font-semibold text-gray-900">
                Total pago mixto: ${totalDesglosado.toLocaleString("es-AR")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Medio de pago
                <select
                  value={medioPago}
                  onChange={(e) => setMedioPago(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                >
                  {MEDIOS_PAGO.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                {usaPlan ? "Pago" : "Importe a cobrar"}
                <input
                  type="number"
                  value={pago}
                  onChange={(e) => setPago(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
            </div>
          )}

          {!usaPlan && (
            <p className="text-right text-sm font-semibold text-gray-900">
              Total prestaciones: ${importeTotal.toLocaleString("es-AR")}
              {Number(pago) + montoAFavorAplicado < importeTotal && (
                <span className="ml-2 font-normal text-amber-700">
                  (queda pendiente ${(importeTotal - Number(pago) - montoAFavorAplicado).toLocaleString("es-AR")} — se
                  liquida igual al profesional)
                </span>
              )}
            </p>
          )}

          {!usaPlan && saldoAFavor > 0 && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {montoAFavorAplicado > 0 ? (
                <div className="flex items-center justify-between">
                  <span>
                    ✓ Se aplicaron ${montoAFavorAplicado.toLocaleString("es-AR")} de saldo a favor a este cobro.
                  </span>
                  <button
                    type="button"
                    onClick={quitarSaldoAplicado}
                    className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span>💰 Este paciente tiene ${saldoAFavor.toLocaleString("es-AR")} a favor.</span>
                  <input
                    type="number"
                    min={0}
                    max={Math.min(saldoAFavor, Number(pago))}
                    value={montoAAplicarInput}
                    onChange={(e) => setMontoAAplicarInput(e.target.value)}
                    placeholder={String(Math.min(saldoAFavor, Number(pago)))}
                    className="w-28 rounded-md border border-emerald-300 px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={aplicarSaldo}
                    className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    Aplicar
                  </button>
                </div>
              )}
            </div>
          )}

          {!usaPlan && (
            <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <input
                type="checkbox"
                checked={precioAnterior}
                onChange={(e) => setPrecioAnterior(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Se cobró con precio anterior (todavía no actualizado)
                <span className="block text-xs text-amber-700">
                  Ajustá arriba el valor real de cada prestación si hace falta. Marcar esto además asegura que la
                  liquidación tome siempre lo efectivamente cobrado, como resguardo.
                </span>
              </span>
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Observaciones
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Registrar cobro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
