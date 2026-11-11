"use client";

import { useEffect, useState } from "react";
import { urlWhatsApp, WHATSAPP_CLINICA_VISIBLE } from "@/lib/planReferidos";
import { consultaBonificadaEl, textoCortoDeFecha } from "@/lib/promoConsulta";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function partesDeFecha(fechaISO) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  const f = new Date(a, m - 1, d);
  return { dia: DIAS[f.getDay()], largo: DIAS_LARGOS[f.getDay()], numero: d, mes: MESES[m - 1], mesNumero: m };
}

// Franjas del día para elegir la preferencia: mañana (hasta las 12:30) o tarde (desde las 13:00).
const LIMITE_TARDE = "13:00";
const FRANJAS = [
  { clave: "manana", texto: "Mañana", detalle: "hasta las 12:30" },
  { clave: "tarde", texto: "Tarde", detalle: "desde las 13:00" },
  { clave: "todas", texto: "Me da igual", detalle: "todos los horarios" },
];
const enFranja = (hora, franja) => franja === "todas" || (franja === "manana" ? hora < LIMITE_TARDE : hora >= LIMITE_TARDE);

const campo = "w-full rounded-xl border-2 border-brand-tan bg-white px-4 py-3 text-base text-brand-charcoal outline-none focus:border-brand-brown";

// "Elegí tu turno": muestra los días y horarios libres para una primera consulta, y deja pedir uno con nombre y WhatsApp. El pedido
// no confirma el turno: queda "pendiente" y Recepción escribe por WhatsApp para cerrarlo.
export default function SelectorTurno({ lugar }) {
  const [estado, setEstado] = useState("cargando"); // cargando | listo | sin-horarios | error
  const [dias, setDias] = useState([]);
  const [franja, setFranja] = useState("todas"); // preferencia: manana | tarde | todas
  const [fechaElegida, setFechaElegida] = useState(null);
  const [horaElegida, setHoraElegida] = useState(null);
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [trampa, setTrampa] = useState(""); // campo oculto: solo los robots lo completan
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [hecho, setHecho] = useState(null);
  const [bonificadaHasta, setBonificadaHasta] = useState(null); // promoción: consulta sin cargo hasta ese día ("2026-11-30")

  async function cargar() {
    try {
      const r = await fetch("/api/publico/horarios").then((x) => x.json());
      if (!r.ok) return setEstado("error");
      setDias(r.dias);
      setBonificadaHasta(r.bonificadaHasta || null);
      setEstado(r.dias.length ? "listo" : "sin-horarios");
      setFechaElegida((actual) => (r.dias.some((d) => d.fecha === actual) ? actual : r.dias[0]?.fecha || null));
    } catch {
      setEstado("error");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  // Según la preferencia, solo quedan los días con horarios en esa franja y, en cada día, solo esas horas.
  const diasDeLaFranja = dias.map((d) => ({ ...d, horas: d.horas.filter((h) => enFranja(h, franja)) })).filter((d) => d.horas.length > 0);
  const cuantosDias = (f) => dias.filter((d) => d.horas.some((h) => enFranja(h, f))).length;
  const diaActual = diasDeLaFranja.find((d) => d.fecha === fechaElegida) || diasDeLaFranja[0] || null;
  const fechaActiva = diaActual?.fecha || null;
  const horaActiva = diaActual?.horas.includes(horaElegida) ? horaElegida : null;

  async function pedir(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/publico/solicitar-turno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, whatsapp, fecha: fechaActiva, hora: horaActiva, acepta, lugar, sitioWeb: trampa }),
      }).then((x) => x.json());
      if (r.ok) {
        setHecho({ texto: r.texto, nombre: nombre.trim(), bonificada: consultaBonificadaEl(fechaActiva, bonificadaHasta) });
      } else {
        setError(r.error || "No pudimos registrar tu pedido.");
        // Si el horario se ocupó mientras elegía, se actualiza la lista para que elija otro.
        if (/horario|reserv/i.test(r.error || "")) {
          setHoraElegida(null);
          cargar();
        }
      }
    } catch {
      setError("No pudimos registrar tu pedido. Probá de nuevo o escribinos por WhatsApp.");
    } finally {
      setEnviando(false);
    }
  }

  const botonWhatsApp = (texto, clase) => (
    <a href={urlWhatsApp(texto)} target="_blank" rel="noreferrer" className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-bold ${clase}`}>
      Escribirnos por WhatsApp
    </a>
  );

  return (
    <div id="turno" className="scroll-mt-20 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-tan/70 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-brown/70">Primera consulta</p>
      <h2 className="font-heading mt-1 text-2xl font-extrabold text-brand-brown sm:text-3xl">Elegí tu turno</h2>
      {bonificadaHasta && (
        <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand-mint/40 px-4 py-1.5 text-sm font-bold text-brand-green">
          🎁 Consulta totalmente bonificada hasta el {textoCortoDeFecha(bonificadaHasta)}
        </p>
      )}

      {estado === "cargando" && <p className="mt-4 text-sm text-brand-charcoal/70">Buscando horarios disponibles…</p>}

      {(estado === "sin-horarios" || estado === "error") && (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-brand-charcoal/85 sm:max-w-sm">
            {estado === "error" ? "No pudimos mostrar los horarios en este momento." : "Por ahora los turnos se coordinan por WhatsApp."} Escribinos y te decimos qué días tenemos lugar.
          </p>
          {botonWhatsApp("¡Hola! Quiero pedir un turno de consulta de ortodoncia. ¿Qué días tienen disponibles?", "bg-brand-green text-brand-cream whitespace-nowrap")}
        </div>
      )}

      {estado === "listo" && !hecho && (
        <>
          <p className="mt-1 text-sm text-brand-charcoal/75">Contanos si preferís la mañana o la tarde y elegí día y hora. Después te escribimos por WhatsApp para confirmarlo.</p>

          <p className="mt-4 text-sm font-semibold text-brand-brown">¿Cuándo te queda mejor?</p>
          <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Preferencia de horario">
            {FRANJAS.map((f) => {
              const cantidad = cuantosDias(f.clave);
              const activa = franja === f.clave;
              return (
                <button
                  key={f.clave}
                  type="button"
                  role="radio"
                  aria-checked={activa}
                  disabled={cantidad === 0}
                  onClick={() => {
                    setFranja(f.clave);
                    setHoraElegida(null);
                  }}
                  className={`flex flex-col items-center rounded-2xl border-2 px-2 py-2.5 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    activa ? "border-brand-green bg-brand-green text-brand-cream" : "border-brand-tan bg-white text-brand-brown hover:border-brand-green"
                  }`}
                >
                  <span className="text-base font-extrabold leading-tight">{f.texto}</span>
                  <span className="text-[11px] leading-tight opacity-80">{f.detalle}</span>
                  <span className="mt-0.5 text-[11px] font-semibold">{cantidad === 0 ? "sin lugar" : `${cantidad} día${cantidad === 1 ? "" : "s"}`}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-sm font-semibold text-brand-brown">Elegí el día</p>
          <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-2" role="listbox" aria-label="Días disponibles">
            {diasDeLaFranja.map((d) => {
              const p = partesDeFecha(d.fecha);
              const activo = d.fecha === fechaActiva;
              return (
                <button
                  key={d.fecha}
                  type="button"
                  role="option"
                  aria-selected={activo}
                  onClick={() => {
                    setFechaElegida(d.fecha);
                    setHoraElegida(null);
                  }}
                  className={`flex w-16 shrink-0 flex-col items-center rounded-2xl border-2 px-2 py-2.5 transition-colors ${
                    activo ? "border-brand-brown bg-brand-brown text-brand-cream" : "border-brand-tan bg-brand-cream text-brand-brown hover:border-brand-brown"
                  }`}
                >
                  <span className="text-xs font-semibold uppercase">{p.dia}</span>
                  <span className="font-heading text-2xl font-extrabold leading-tight">{p.numero}</span>
                  <span className="text-[11px] uppercase opacity-80">{p.mes}</span>
                  {consultaBonificadaEl(d.fecha, bonificadaHasta) && <span className="mt-0.5 rounded-full bg-brand-mint px-1.5 text-[9px] font-extrabold uppercase text-brand-green">sin cargo</span>}
                </button>
              );
            })}
          </div>

          {diaActual && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-brand-brown first-letter:uppercase">
                {partesDeFecha(diaActual.fecha).largo} {partesDeFecha(diaActual.fecha).numero} de {MESES[partesDeFecha(diaActual.fecha).mesNumero - 1]}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {diaActual.horas.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHoraElegida(h)}
                    className={`rounded-xl border-2 py-2.5 text-base font-bold tabular-nums transition-colors ${
                      h === horaActiva ? "border-brand-green bg-brand-green text-brand-cream" : "border-brand-tan bg-white text-brand-charcoal hover:border-brand-green"
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {horaActiva && (
            <form onSubmit={pedir} className="mt-5 rounded-2xl bg-brand-cream p-4 ring-1 ring-brand-tan/70">
              <p className="font-semibold text-brand-brown">
                Tu turno: {partesDeFecha(fechaActiva).largo} {partesDeFecha(fechaActiva).numero}/{String(partesDeFecha(fechaActiva).mesNumero).padStart(2, "0")} a las {horaActiva}
              </p>
              {bonificadaHasta && (
                <p className="mt-1 text-sm font-semibold text-brand-green">
                  {consultaBonificadaEl(fechaActiva, bonificadaHasta)
                    ? "🎁 Tu consulta es totalmente bonificada: sin ningún costo."
                    : `Este día queda fuera de la consulta sin cargo (vale hasta el ${textoCortoDeFecha(bonificadaHasta)}). El valor te lo confirmamos por WhatsApp.`}
                </p>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-brand-charcoal/80">Nombre y apellido</span>
                  <input className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" required maxLength={80} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-brand-charcoal/80">Tu WhatsApp</span>
                  <input className={campo} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="341 555 1234" required maxLength={20} />
                </label>
              </div>
              {/* Campo trampa para robots: está fuera de la vista y las personas no lo ven ni lo completan */}
              <input
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={trampa}
                onChange={(e) => setTrampa(e.target.value)}
                name="sitioWeb"
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              />
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-brand-charcoal/85">
                <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1 h-4 w-4 accent-brand-green" />
                <span>Acepto que la clínica me escriba por WhatsApp para confirmar el turno.</span>
              </label>
              {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
              <button
                type="submit"
                disabled={enviando || !acepta || !nombre.trim() || !whatsapp.trim()}
                className="mt-4 w-full rounded-full bg-brand-green px-6 py-3.5 text-base font-bold text-brand-cream transition-opacity disabled:opacity-50 sm:w-auto"
              >
                {enviando ? "Enviando…" : "Pedir este turno"}
              </button>
            </form>
          )}
        </>
      )}

      {hecho && (
        <div className="mt-4 rounded-2xl bg-brand-mint/30 p-5 ring-1 ring-brand-mint">
          <p className="font-heading text-2xl font-extrabold text-brand-green">¡Listo, {hecho.nombre.split(" ")[0]}!</p>
          <p className="mt-1 text-brand-charcoal/90">
            Pediste turno para el <strong>{hecho.texto}</strong>. Te vamos a escribir por WhatsApp para confirmarlo. Si querés, también podés escribirnos vos ahora.
          </p>
          {hecho.bonificada && <p className="mt-2 font-semibold text-brand-green">🎁 Recordá que tu consulta es totalmente bonificada.</p>}
          <div className="mt-4">
            {botonWhatsApp(`¡Hola! Soy ${hecho.nombre}. Acabo de pedir turno de consulta de ortodoncia para el ${hecho.texto} desde la página.`, "bg-brand-green text-brand-cream")}
          </div>
          <p className="mt-3 text-xs text-brand-charcoal/60">WhatsApp {WHATSAPP_CLINICA_VISIBLE}</p>
        </div>
      )}
    </div>
  );
}
