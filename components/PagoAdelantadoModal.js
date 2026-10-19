"use client";

import { useMemo, useState } from "react";
import { crearCobro } from "@/lib/data/caja";
import { crearCobroOrtodoncia } from "@/lib/data/cajaOrtodoncia";
import { agregarSaldoAFavor } from "@/lib/data/saldosAFavor";

const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR"];

function pesos(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
}

// Pago adelantado: el paciente paga una parte antes de venir al turno (por ejemplo la 1ª cuota de
// la instalación) y el resto lo abona ese día. La plata entra a la caja ahora y queda anotada
// como saldo a favor del paciente: cuando venga y le cobren, aparece "tiene $X a favor" para
// aplicarlo. No se liquida a ningún profesional (no tiene prestaciones cargadas).
//
// `pacientes` y `profesionales` son los mismos que usa el cobro de esa caja (Ortodoncia: pacientes
// de ortodoncia y ortodoncistas; General: pacientes y profesionales).
export default function PagoAdelantadoModal({ esOrtodoncia, fecha, pacientes, profesionales, onClose, onCreado }) {
  const [pacienteId, setPacienteId] = useState("");
  const [profesionalId, setProfesionalId] = useState("");
  const [monto, setMonto] = useState("");
  const [total, setTotal] = useState("");
  const [nota, setNota] = useState("");
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [pagoMixto, setPagoMixto] = useState(false);
  const [desglose, setDesglose] = useState([
    { medio: "Efectivo", monto: "" },
    { medio: "Transferencia", monto: "" },
  ]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const paciente = useMemo(() => pacientes.find((p) => p.id === pacienteId), [pacientes, pacienteId]);
  const nombreDe = (p) => (esOrtodoncia ? p.nombre : p.apellido_y_nombre);

  const totalDesglosado = desglose.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  const importe = pagoMixto ? totalDesglosado : Number(monto) || 0;
  const resto = Number(total) > importe ? Number(total) - importe : 0;

  function elegirPaciente(id) {
    setPacienteId(id);
    const p = pacientes.find((x) => x.id === id);
    // Ortodoncia: el ortodoncista habitual del paciente; General: su profesional responsable.
    setProfesionalId((esOrtodoncia ? p?.ortodoncistaId : p?.profesional_responsable_id) || "");
  }

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    if (!pacienteId) return setError("Falta elegir el paciente.");
    if (!importe || importe <= 0) return setError("El monto tiene que ser mayor a cero.");
    if (pagoMixto) {
      if (desglose.some((p) => !p.medio || !p.monto || Number(p.monto) <= 0)) {
        return setError("Completá el medio y el monto de cada parte del pago mixto.");
      }
      if (new Set(desglose.map((p) => p.medio)).size !== desglose.length) {
        return setError("No repitas el mismo medio de pago dos veces — sumalo en una sola parte.");
      }
    }
    if (Number(total) > 0 && Number(total) < importe) {
      return setError("El total que va a pagar no puede ser menor a lo que paga ahora.");
    }

    const descripcion = [
      "Pago adelantado",
      nota.trim() ? `: ${nota.trim()}` : "",
      resto > 0 ? ` — resto ${pesos(resto)} para el día del turno` : "",
    ].join("");
    const desglosePago = pagoMixto ? desglose.map((p) => ({ medio: p.medio, monto: Number(p.monto) })) : null;

    setGuardando(true);
    let cobro = null;
    try {
      if (esOrtodoncia) {
        cobro = await crearCobroOrtodoncia({
          fecha,
          pacienteId,
          ortodoncistaId: profesionalId || null,
          ortodoncistaResponsableId: paciente?.ortodoncistaId || null,
          concepto: "Pago adelantado",
          importe,
          medioPago,
          desglosePago,
          observaciones: descripcion,
        });
      } else {
        cobro = await crearCobro({
          fecha,
          tipo: "Particular",
          cobertura: "Particular",
          pacienteId,
          dni: paciente?.dni,
          numeroAfiliado: paciente?.numero_afiliado,
          profesionalResponsableId: paciente?.profesional_responsable_id || null,
          profesionalAtencionId: profesionalId || null,
          modalidad: "Pago adelantado",
          prestaciones: [],
          importeTotal: importe,
          pago: importe,
          medioPago,
          desglosePago,
          saldoPendiente: null,
          observaciones: descripcion,
        });
      }
      try {
        await agregarSaldoAFavor({
          pacienteId,
          esOrtodoncia,
          monto: importe,
          motivo: descripcion,
          fecha,
          ...(esOrtodoncia ? { cajaOrtodonciaId: cobro.id } : { cajaGeneralId: cobro.id }),
        });
      } catch (errSaldo) {
        setError(
          `El pago se registró en la caja, pero no se pudo anotar el saldo a favor (${errSaldo.message}). Cargalo a mano desde la ficha del paciente, en Saldo a favor.`
        );
        setGuardando(false);
        return;
      }
      onCreado();
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            Pago adelantado — {esOrtodoncia ? "Ortodoncia" : "Odontología General"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          El paciente paga una parte ahora y el resto el día del turno. La plata entra a la caja hoy y queda como saldo a
          favor: cuando venga, al cobrarle aparece para aplicarlo. No se liquida a ningún profesional.
        </p>

        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

        <form onSubmit={guardar} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Paciente
            <select
              value={pacienteId}
              onChange={(e) => elegirPaciente(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              <option value="">Elegí un paciente...</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {nombreDe(p)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            {esOrtodoncia ? "Ortodoncista que lo va a atender" : "Profesional que lo va a atender"} (opcional)
            <select
              value={profesionalId}
              onChange={(e) => setProfesionalId(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              <option value="">(sin elegir)</option>
              {profesionales.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.nombre}
                </option>
              ))}
            </select>
          </label>

          {!pagoMixto && (
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Monto que paga ahora
              <input
                type="number"
                min={0}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={pagoMixto} onChange={(e) => setPagoMixto(e.target.checked)} />
            Pago mixto (más de un medio de pago)
          </label>

          {pagoMixto ? (
            <div className="flex flex-col gap-2">
              {desglose.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={p.medio}
                    onChange={(e) => setDesglose((d) => d.map((x, j) => (j === i ? { ...x, medio: e.target.value } : x)))}
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
                    onChange={(e) => setDesglose((d) => d.map((x, j) => (j === i ? { ...x, monto: e.target.value } : x)))}
                    placeholder="Monto"
                    className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
              ))}
              <p className="text-xs text-gray-500">Total: {pesos(totalDesglosado)}</p>
            </div>
          ) : (
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
          )}

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            ¿De cuánto es el total de lo que va a pagar? (opcional, para anotar el resto)
            <input
              type="number"
              min={0}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="Ej: 150000"
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>
          {resto > 0 && (
            <p className="-mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Queda <strong>{pesos(resto)}</strong> para cuando venga al turno.
            </p>
          )}

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Nota (opcional)
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: 1ª cuota de la instalación"
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <div className="flex justify-end gap-2">
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
              {guardando ? "Guardando..." : "Registrar pago adelantado"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
