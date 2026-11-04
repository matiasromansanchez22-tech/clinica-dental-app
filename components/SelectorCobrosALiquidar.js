"use client";

import { useEffect, useMemo, useState } from "react";
import { obtenerCobrosPendientesDeLiquidar } from "@/lib/data/cobrosLiquidados";

function formatoFecha(fechaISO) {
  const [, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}`;
}

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

// Diferencia que se tolera entre la suma de lo tildado y el monto del pago (redondeos).
const TOLERANCIA_SUMA = 500;

// Cuenta de cada cobro tildado: lo que le corresponde al profesional, lo que ya se le pagó antes,
// lo que se le paga ahora (todo lo que falta si es "Total", o lo que se escriba si es "Una parte")
// y lo que queda faltando.
function cuentaDe(item) {
  const corresponde = Number(item.corresponde) || 0;
  const pendiente = Math.max(0, corresponde - item.yaPagado);
  const ahora = item.modo === "total" ? pendiente : Number(item.montoParte) || 0;
  return { corresponde, pendiente, ahora, falta: Math.max(0, pendiente - ahora) };
}

// Lo que se guarda de cada cobro tildado (ver marcarCobrosLiquidados).
export function cobrosParaMarcar(seleccion) {
  return seleccion.map((s) => {
    const c = cuentaDe(s);
    return { tipo: s.tipo, id: s.id, parcial: s.modo === "parte", honorarios: c.corresponde, montoPagado: c.ahora };
  });
}

// Texto del problema si la selección no está bien cargada, o null si está todo bien.
export function errorDeSeleccion(seleccion) {
  for (const s of seleccion) {
    const c = cuentaDe(s);
    if (c.corresponde <= 0) return `Falta cargar cuánto le corresponde al profesional por ${s.paciente}.`;
    if (s.modo === "total" && c.ahora <= 0) return `${s.paciente}: ya estaba pagado por completo; destildalo.`;
    if (s.modo === "parte") {
      if (c.ahora <= 0) return `${s.paciente}: escribí cuánto se le pagó (o elegí "Total").`;
      if (c.ahora >= c.pendiente - 1) return `${s.paciente}: se le pagó todo lo que le corresponde, elegí "Total".`;
    }
  }
  return null;
}

export function sumaDeSeleccion(seleccion) {
  return seleccion.reduce((a, s) => a + cuentaDe(s).ahora, 0);
}

function FilaCobro({ cobro, tildado, onAlternar, sangria }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2 py-1.5 pr-2 text-xs hover:bg-brand-tan/20 ${sangria ? "pl-7" : "pl-2"}`}>
      <input type="checkbox" checked={tildado} onChange={onAlternar} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">
        {!sangria && <span className="font-medium text-gray-900">{cobro.paciente}</span>}
        <span className={`block truncate ${sangria ? "text-gray-700" : "text-gray-500"}`}>{cobro.detalle}</span>
        {cobro.lineas?.length > 0 && (
          <span className="block text-[10px] leading-snug text-gray-500">
            {cobro.lineas.slice(0, 3).map((l, i) => (
              <span key={i} className="block">
                {l.calculo}
              </span>
            ))}
            {cobro.lineas.length > 3 && <span className="block">y {cobro.lineas.length - 3} línea{cobro.lineas.length - 3 === 1 ? "" : "s"} más</span>}
          </span>
        )}
        {cobro.otrosProfesionales?.length > 0 && (
          <span className="block text-[10px] font-medium text-sky-700">El resto de este cobro le corresponde a {cobro.otrosProfesionales.join(", ")}</span>
        )}
        {cobro.yaPagado > 0 && (
          <span className="block text-[10px] font-medium text-amber-700">
            Pago parcial: ya se le pagó {formatoPesos(cobro.yaPagado)} · falta {formatoPesos(cobro.falta)}
          </span>
        )}
      </span>
      <span className="shrink-0 text-right text-gray-700">
        <span className="block font-semibold tabular-nums text-brand-brown">
          {cobro.falta > 0 ? `Le corresponde ${formatoPesos(cobro.falta)}` : "Sin valor"}
        </span>
        <span className="block text-[10px] text-gray-400">
          Cobró {formatoPesos(cobro.monto)} · {formatoFecha(cobro.fecha)} · {cobro.cobertura}
        </span>
      </span>
    </label>
  );
}

// Cada cobro tildado, con la cuenta de lo que se le paga al profesional: "Total" o "Una parte".
function CuentaDelCobro({ item, onCambiar, onQuitar }) {
  const c = cuentaDe(item);
  return (
    <li className="border-b border-gray-100 px-2 py-2 text-xs last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="font-medium text-gray-900">{item.paciente}</span>
          <span className="block truncate text-gray-500">{item.detalle}</span>
        </span>
        <button type="button" onClick={onQuitar} aria-label="Sacar este cobro" className="text-gray-400 hover:text-red-600">
          ✕
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="flex items-center gap-1 text-gray-600">
          Le corresponde
          <input
            type="number"
            min={0}
            value={item.corresponde}
            onChange={(e) => onCambiar({ corresponde: e.target.value })}
            className="w-24 rounded border border-gray-300 px-1.5 py-0.5 text-right tabular-nums text-gray-900"
          />
        </label>
        <div className="flex overflow-hidden rounded border border-gray-300">
          {[
            ["total", "Se le pagó el total"],
            ["parte", "Una parte"],
          ].map(([modo, texto]) => (
            <button
              key={modo}
              type="button"
              onClick={() => onCambiar({ modo })}
              className={`px-2 py-0.5 ${item.modo === modo ? (modo === "parte" ? "bg-amber-500 text-white" : "bg-brand-brown text-white") : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              {texto}
            </button>
          ))}
        </div>
        {item.modo === "parte" && (
          <label className="flex items-center gap-1 text-gray-600">
            Se le pagó ahora
            <input
              type="number"
              min={0}
              value={item.montoParte}
              onChange={(e) => onCambiar({ montoParte: e.target.value })}
              className="w-24 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-right tabular-nums text-gray-900"
            />
          </label>
        )}
      </div>
      <p className="mt-1 text-[11px] text-gray-500">
        {item.yaPagado > 0 && <>Ya se le había pagado {formatoPesos(item.yaPagado)}. </>}
        Ahora: <strong className="text-gray-800">{formatoPesos(c.ahora)}</strong>
        {item.modo === "parte" && c.falta > 0 && (
          <>
            {" · "}
            <strong className="text-amber-700">Falta {formatoPesos(c.falta)}</strong> (queda pendiente)
          </>
        )}
      </p>
    </li>
  );
}

// Lista de los cobros recientes del profesional que todavía no se le liquidaron por completo, agrupados
// por paciente, para tildar cuáles cubre este pago (un paciente completo con su casilla, o cobro por
// cobro). De cada cobro tildado se indica si se le pagó el total de lo que le corresponde o solo una
// parte (en ese caso el cobro sigue pendiente y figura lo que falta). Con `obligatorio`, hay que tildar
// al menos un paciente, o indicar que el pago no es por pacientes puntuales (ajuste, adelanto, etc.).
//   seleccion: [{ clave, tipo, id, paciente, detalle, corresponde, yaPagado, modo, montoParte }]
//   tratamientoSaldado / onTratamientoSaldadoChange: la casilla "se saldó todo el tratamiento"
//   montoPago: monto del pago, para avisar si no coincide con la suma de lo tildado
//   sinPacientes / onSinPacientesChange: la salida para pagos que no son por pacientes
export default function SelectorCobrosALiquidar({
  profesionalId,
  seleccion,
  onChange,
  tratamientoSaldado,
  onTratamientoSaldadoChange,
  montoPago,
  montoSugerido,
  obligatorio = false,
  sinPacientes = false,
  onSinPacientesChange,
  fechaPago,
}) {
  // Se guarda para qué profesional se cargó la lista: mientras no coincida con el elegido
  // ahora, se muestra "Cargando..." (así no aparece la lista de otro profesional).
  const [cargado, setCargado] = useState({ profesionalId: null, cobros: [], error: null });
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(obligatorio);
  // Por defecto solo se ven los cobros del día del pago (más los que quedaron pagados en parte, que siguen pendientes):
  // los cobros viejos que se pagaron antes de que existiera el tildado no se marcaron y harían ruido. Se puede cambiar el
  // día o ver todos los de los últimos 60 días.
  const [diaElegido, setDiaElegido] = useState(null);
  const [verTodos, setVerTodos] = useState(false);
  const dia = diaElegido || fechaPago || null;

  useEffect(() => {
    if (!profesionalId) return;
    let activo = true;
    obtenerCobrosPendientesDeLiquidar(profesionalId)
      .then((cobros) => activo && setCargado({ profesionalId, cobros, error: null }))
      .catch((e) => activo && setCargado({ profesionalId, cobros: [], error: e.message }));
    return () => {
      activo = false;
    };
  }, [profesionalId]);

  const cargando = cargado.profesionalId !== profesionalId;
  const cobros = useMemo(() => (cargando ? [] : cargado.cobros), [cargando, cargado.cobros]);
  const error = cargando ? null : cargado.error;

  const claves = new Set(seleccion.map((s) => s.clave));
  const texto = busqueda.trim().toLowerCase();

  // Un grupo por paciente (la lista ya viene de más nuevo a más viejo, así que los grupos
  // quedan ordenados por su cobro más reciente).
  const cobrosDelDia = useMemo(
    () => (verTodos || !dia ? cobros : cobros.filter((c) => c.fecha === dia || c.yaPagado > 0)),
    [cobros, verTodos, dia]
  );
  const ocultosPorDia = cobros.length - cobrosDelDia.length;
  const grupos = useMemo(() => {
    const visibles = texto ? cobrosDelDia.filter((c) => `${c.paciente} ${c.detalle}`.toLowerCase().includes(texto)) : cobrosDelDia;
    const mapa = new Map();
    for (const c of visibles) {
      if (!mapa.has(c.paciente)) mapa.set(c.paciente, []);
      mapa.get(c.paciente).push(c);
    }
    return [...mapa.entries()].map(([paciente, lista]) => ({ paciente, cobros: lista }));
  }, [cobrosDelDia, texto]);

  if (!profesionalId) return null;

  const pacientesElegidos = new Set(seleccion.map((s) => s.paciente)).size;
  const suma = sumaDeSeleccion(seleccion);
  const hayParciales = seleccion.some((s) => s.modo === "parte");
  const diferencia = (Number(montoPago) || 0) - suma;
  const coincide = montoPago === undefined || !(Number(montoPago) > 0) ? null : Math.abs(diferencia) <= TOLERANCIA_SUMA;

  const nuevoItem = (c) => ({
    clave: c.clave,
    tipo: c.tipo,
    id: c.id,
    paciente: c.paciente,
    detalle: c.detalle,
    corresponde: c.honorarios ? String(Math.round(c.honorarios)) : "",
    yaPagado: c.yaPagado || 0,
    modo: "total",
    montoParte: "",
  });

  function alternarCobro(c) {
    if (claves.has(c.clave)) onChange(seleccion.filter((s) => s.clave !== c.clave));
    else onChange([...seleccion, nuevoItem(c)]);
  }

  // Tilda (o destilda) todos los cobros pendientes de un paciente de una vez.
  function alternarPaciente(grupo) {
    const todosTildados = grupo.cobros.every((c) => claves.has(c.clave));
    if (todosTildados) {
      const aSacar = new Set(grupo.cobros.map((c) => c.clave));
      onChange(seleccion.filter((s) => !aSacar.has(s.clave)));
    } else {
      onChange([...seleccion, ...grupo.cobros.filter((c) => !claves.has(c.clave)).map(nuevoItem)]);
    }
  }

  function cambiarItem(clave, cambios) {
    onChange(seleccion.map((s) => (s.clave === clave ? { ...s, ...cambios } : s)));
  }

  return (
    <div className="col-span-2 rounded-md border border-gray-200 bg-gray-50 p-2">
      <button type="button" onClick={() => setAbierto((a) => !a)} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="text-xs font-semibold text-gray-700">
          {abierto ? "▾" : "▸"} ¿Qué pacientes cubre este pago?{" "}
          <span className={`font-normal ${obligatorio ? "text-red-600" : "text-gray-400"}`}>({obligatorio ? "obligatorio" : "opcional"})</span>
        </span>
        {seleccion.length > 0 && (
          <span className="text-[11px] font-medium text-brand-brown">
            {pacientesElegidos} paciente{pacientesElegidos === 1 ? "" : "s"} · {formatoPesos(suma)}
          </span>
        )}
      </button>

      {obligatorio && onSinPacientesChange && seleccion.length === 0 && (
        <label className="mt-1.5 flex cursor-pointer items-start gap-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700">
          <input type="checkbox" checked={sinPacientes} onChange={(e) => onSinPacientesChange(e.target.checked)} className="mt-0.5 shrink-0" />
          <span>
            <strong>Este pago no es por pacientes puntuales</strong> (ajuste, adelanto, diferencia de un mes anterior, etc.). Lo explico en
            Observaciones.
          </span>
        </label>
      )}

      {abierto && !sinPacientes && (
        <>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
            {!verTodos && dia ? (
              <label className="flex items-center gap-1">
                Cobros del día
                <input
                  type="date"
                  value={dia}
                  onChange={(e) => setDiaElegido(e.target.value || null)}
                  className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-900"
                />
              </label>
            ) : (
              <span>Todos los cobros de los últimos 60 días sin liquidar por completo</span>
            )}
            <button type="button" onClick={() => setVerTodos((v) => !v)} className="font-medium text-blue-600 hover:underline">
              {verTodos ? "Ver solo los de un día" : `Ver también días anteriores${ocultosPorDia > 0 ? ` (${ocultosPorDia})` : ""}`}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-gray-500">Tildá al paciente para marcar todos sus cobros, o elegí uno por uno.</p>
          {cobrosDelDia.length > 6 && (
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar paciente o prestación..."
              className="mt-1.5 w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
          )}
          {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
          {cargando && <p className="mt-1 text-xs text-gray-500">Cargando cobros...</p>}
          {!cargando && !error && cobrosDelDia.length === 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {verTodos || !dia
                ? "No hay cobros pendientes de liquidar de este profesional."
                : `No hay cobros de este profesional el ${dia.split("-").reverse().join("/")}.${ocultosPorDia > 0 ? ` Hay ${ocultosPorDia} de días anteriores: tocá «Ver también días anteriores».` : ""}`}
            </p>
          )}
          {grupos.length > 0 && (
            <ul className="mt-1.5 max-h-44 overflow-y-auto rounded-md border border-gray-200 bg-white">
              {grupos.map((g) => {
                if (g.cobros.length === 1) {
                  const c = g.cobros[0];
                  return (
                    <li key={g.paciente} className="border-b border-gray-100 last:border-b-0">
                      <FilaCobro cobro={c} tildado={claves.has(c.clave)} onAlternar={() => alternarCobro(c)} />
                    </li>
                  );
                }
                const tildados = g.cobros.filter((c) => claves.has(c.clave)).length;
                const totalGrupo = g.cobros.reduce((a, c) => a + c.falta, 0);
                return (
                  <li key={g.paciente} className="border-b border-gray-100 last:border-b-0">
                    <label className="flex cursor-pointer items-center gap-2 bg-gray-50 px-2 py-1.5 text-xs hover:bg-brand-tan/20">
                      <input
                        type="checkbox"
                        checked={tildados === g.cobros.length}
                        ref={(el) => {
                          if (el) el.indeterminate = tildados > 0 && tildados < g.cobros.length;
                        }}
                        onChange={() => alternarPaciente(g)}
                        className="shrink-0"
                      />
                      <span className="min-w-0 flex-1 font-medium text-gray-900">
                        {g.paciente} <span className="font-normal text-gray-400">· {g.cobros.length} cobros</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-brand-brown">Le corresponde {formatoPesos(totalGrupo)}</span>
                    </label>
                    {g.cobros.map((c) => (
                      <FilaCobro key={c.clave} cobro={c} sangria tildado={claves.has(c.clave)} onAlternar={() => alternarCobro(c)} />
                    ))}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {seleccion.length > 0 && (
        <>
          <ul className="mt-1.5 rounded-md border border-gray-200 bg-white">
            {seleccion.map((s) => (
              <CuentaDelCobro
                key={s.clave}
                item={s}
                onCambiar={(cambios) => cambiarItem(s.clave, cambios)}
                onQuitar={() => onChange(seleccion.filter((x) => x.clave !== s.clave))}
              />
            ))}
          </ul>
          <div
            className={`mt-1.5 rounded-md border px-3 py-2 text-xs ${
              coincide === false ? "border-amber-300 bg-amber-50 text-amber-900" : coincide ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-gray-300 bg-white text-gray-800"
            }`}
          >
            <p className="flex items-baseline justify-between gap-2">
              <span>
                Total a pagar ({pacientesElegidos} paciente{pacientesElegidos === 1 ? "" : "s"})
              </span>
              <strong className="text-base tabular-nums">{formatoPesos(suma)}</strong>
            </p>
            {montoPago !== undefined && (
              <p className="mt-0.5 flex items-baseline justify-between gap-2">
                <span>Monto del pago que estás cargando</span>
                <span className="font-medium tabular-nums">{formatoPesos(Number(montoPago) || 0)}</span>
              </p>
            )}
            {montoSugerido > 0 && (
              <p className="mt-0.5 flex items-baseline justify-between gap-2">
                <span>Según Producción, le corresponde</span>
                <span className="font-medium tabular-nums">{formatoPesos(montoSugerido)}</span>
              </p>
            )}
            {coincide !== null && (
              <p className="mt-1 font-semibold">
                {coincide
                  ? "✓ Coincide con el monto del pago"
                  : diferencia > 0
                    ? `⚠ No coincide: el pago es ${formatoPesos(diferencia)} más que lo tildado. Tildá más pacientes o corregí el monto.`
                    : `⚠ No coincide: lo tildado es ${formatoPesos(-diferencia)} más que el pago. Revisá los montos.`}
              </p>
            )}
          </div>
        </>
      )}

      {seleccion.length > 0 && !hayParciales && onTratamientoSaldadoChange && (
        <label className="mt-1.5 flex cursor-pointer items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900">
          <input
            type="checkbox"
            checked={Boolean(tratamientoSaldado)}
            onChange={(e) => onTratamientoSaldadoChange(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span>
            <strong>Con este pago se saldó todo el tratamiento.</strong> El paciente pagó todo y a la profesional se le pagó el
            total: queda como <strong>Tratamiento saldado ✓</strong>.
          </span>
        </label>
      )}

    </div>
  );
}
