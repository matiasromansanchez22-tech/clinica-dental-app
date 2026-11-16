"use client";

import { useEffect, useState } from "react";
import { urlWhatsApp, WHATSAPP_CLINICA_VISIBLE } from "@/lib/planReferidos";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function partesDeFecha(fechaISO) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  const f = new Date(a, m - 1, d);
  return { dia: DIAS[f.getDay()], largo: DIAS_LARGOS[f.getDay()], numero: d, mes: MESES[m - 1], mesNumero: m };
}

// Franjas del día: mañana (hasta las 12:30) o tarde (desde las 13:00).
const LIMITE_TARDE = "13:00";
const FRANJAS = [
  { clave: "manana", texto: "Mañana", detalle: "hasta las 12:30" },
  { clave: "tarde", texto: "Tarde", detalle: "desde las 13:00" },
  { clave: "todas", texto: "Me da igual", detalle: "todos los horarios" },
];
const enFranja = (hora, franja) => franja === "todas" || (franja === "manana" ? hora < LIMITE_TARDE : hora >= LIMITE_TARDE);

const campo = "w-full rounded-xl border-2 border-brand-tan bg-white px-4 py-3 text-base text-brand-charcoal outline-none focus:border-brand-brown";
const MENSAJE_WHATSAPP = "¡Hola! Vi la página de la clínica y quiero pedir un turno de odontología.";

// "Pedí tu turno" de Odontología General: primero se elige para qué es la consulta; según eso se muestran los días y horarios de los
// profesionales que atienden ese motivo. El pedido no confirma el turno: queda pendiente y Recepción escribe por WhatsApp para cerrarlo.
export default function SelectorTurnoGeneral({ lugar }) {
  const [datos, setDatos] = useState(null); // { motivos, obrasSociales, precioConsulta }
  const [errorDatos, setErrorDatos] = useState(false);
  const [motivo, setMotivo] = useState(null);
  const [estado, setEstado] = useState("inicial"); // inicial | cargando | listo | sin-horarios | error
  const [dias, setDias] = useState([]);
  const [franja, setFranja] = useState("todas");
  const [fechaElegida, setFechaElegida] = useState(null);
  const [horaElegida, setHoraElegida] = useState(null);
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [esPaciente, setEsPaciente] = useState(false);
  const [dni, setDni] = useState("");
  const [obraSocial, setObraSocial] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [trampa, setTrampa] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [hecho, setHecho] = useState(null);

  useEffect(() => {
    fetch("/api/publico/general")
      .then((x) => x.json())
      .then((r) => (r.ok && r.motivos?.length ? setDatos(r) : setErrorDatos(true)))
      .catch(() => setErrorDatos(true));
  }, []);

  async function cargarHorarios(clave) {
    setEstado("cargando");
    setDias([]);
    setHoraElegida(null);
    try {
      const r = await fetch(`/api/publico/horarios-general?motivo=${encodeURIComponent(clave)}`, { cache: "no-store" }).then((x) => x.json());
      if (!r.ok) return setEstado("error");
      setDias(r.dias);
      setEstado(r.dias.length ? "listo" : "sin-horarios");
      setFechaElegida(r.dias[0]?.fecha || null);
    } catch {
      setEstado("error");
    }
  }

  function elegirMotivo(m) {
    setMotivo(m);
    setHecho(null);
    setError(null);
    if (m.accion === "turno") cargarHorarios(m.clave);
    else setEstado("inicial");
  }

  const diasDeLaFranja = dias.map((d) => ({ ...d, horas: d.horas.filter((h) => enFranja(h.hora, franja)) })).filter((d) => d.horas.length > 0);
  const cuantosDias = (f) => dias.filter((d) => d.horas.some((h) => enFranja(h.hora, f))).length;
  const diaActual = diasDeLaFranja.find((d) => d.fecha === fechaElegida) || diasDeLaFranja[0] || null;
  const fechaActiva = diaActual?.fecha || null;
  const horaActiva = diaActual?.horas.some((h) => h.hora === horaElegida) ? horaElegida : null;
  const conQuien = diaActual?.horas.find((h) => h.hora === horaActiva)?.con || [];

  async function pedir(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/publico/solicitar-turno-general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, whatsapp, dni, esPaciente, obraSocial, motivo: motivo.clave, fecha: fechaActiva, hora: horaActiva, acepta, lugar, sitioWeb: trampa }),
      }).then((x) => x.json());
      if (r.ok) {
        setHecho({ texto: r.texto, nombre: nombre.trim(), con: r.con, motivo: motivo.nombre });
      } else {
        setError(r.error || "No pudimos registrar tu pedido.");
        if (/horario|reserv/i.test(r.error || "")) {
          setHoraElegida(null);
          cargarHorarios(motivo.clave);
        }
      }
    } catch {
      setError("No pudimos registrar tu pedido. Probá de nuevo o escribinos por WhatsApp.");
    } finally {
      setEnviando(false);
    }
  }

  const botonWhatsApp = (texto, clase, etiqueta = "Escribirnos por WhatsApp") => (
    <a href={urlWhatsApp(texto)} target="_blank" rel="noreferrer" className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-bold ${clase}`}>
      {etiqueta}
    </a>
  );

  return (
    <div id="turno" className="scroll-mt-20 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-tan/70 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-brown/70">Odontología</p>
      <h2 className="font-heading mt-1 text-2xl font-extrabold text-brand-brown sm:text-3xl">Pedí tu turno</h2>

      {!datos && !errorDatos && <p className="mt-4 text-sm text-brand-charcoal/70">Cargando…</p>}
      {errorDatos && (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-brand-charcoal/85 sm:max-w-sm">No pudimos mostrar los turnos en este momento. Escribinos y te decimos qué días tenemos lugar.</p>
          {botonWhatsApp(MENSAJE_WHATSAPP, "bg-brand-green text-brand-cream whitespace-nowrap")}
        </div>
      )}

      {datos && !hecho && (
        <>
          <p className="mt-1 text-sm text-brand-charcoal/75">Contanos para qué es tu consulta y te mostramos los horarios de quienes atienden eso.</p>

          <p className="mt-4 text-sm font-semibold text-brand-brown">¿Para qué es la consulta?</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Motivo de la consulta">
            {datos.motivos.map((m) => {
              const activo = motivo?.clave === m.clave;
              return (
                <button
                  key={m.clave}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => elegirMotivo(m)}
                  className={`flex flex-col rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                    activo ? "border-brand-brown bg-brand-brown text-brand-cream" : "border-brand-tan bg-white text-brand-brown hover:border-brand-brown"
                  }`}
                >
                  <span className="text-base font-extrabold leading-tight">{m.nombre}</span>
                  {m.descripcion && <span className="mt-0.5 text-xs leading-snug opacity-80">{m.descripcion}</span>}
                </button>
              );
            })}
          </div>

          {motivo?.accion === "whatsapp" && (
            <div className="mt-4 rounded-2xl bg-brand-cream p-4 ring-1 ring-brand-tan/70">
              <p className="text-sm text-brand-charcoal/90">{motivo.mensaje || "Escribinos por WhatsApp y lo coordinamos."}</p>
              <div className="mt-3">{botonWhatsApp(`¡Hola! Necesito un turno por ${motivo.nombre.toLowerCase()}.`, "bg-brand-green text-brand-cream", "Escribir por WhatsApp ahora")}</div>
            </div>
          )}

          {motivo?.accion === "ortodoncia" && (
            <div className="mt-4 rounded-2xl bg-brand-cream p-4 ring-1 ring-brand-tan/70">
              <p className="text-sm text-brand-charcoal/90">Los turnos de ortodoncia se piden en su propia página, con los valores y los horarios de la consulta.</p>
              <a href={`/ortodoncia-info?desde=odontologia${lugar ? `&lugar=${lugar}` : ""}#turno`} className="mt-3 inline-flex items-center justify-center rounded-full bg-brand-green px-6 py-3 text-base font-bold text-brand-cream">
                Ir a ortodoncia
              </a>
            </div>
          )}

          {motivo?.accion === "turno" && (
            <>
              {motivo.clave === "consulta" && datos.precioConsulta && (
                <p className="mt-4 inline-flex rounded-full bg-brand-mint/40 px-4 py-1.5 text-sm font-semibold text-brand-green">
                  Consulta inicial particular: ${datos.precioConsulta.toLocaleString("es-AR")} · con obra social te confirmamos la cobertura
                </p>
              )}
              {estado === "cargando" && <p className="mt-4 text-sm text-brand-charcoal/70">Buscando horarios disponibles…</p>}
              {(estado === "sin-horarios" || estado === "error") && (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-brand-charcoal/85 sm:max-w-sm">
                    {estado === "error" ? "No pudimos mostrar los horarios en este momento." : "Por ahora no tenemos horarios para este motivo en la página."} Escribinos y te decimos qué días hay lugar.
                  </p>
                  {botonWhatsApp(`¡Hola! Quiero pedir un turno por ${motivo.nombre.toLowerCase()}. ¿Qué días tienen disponibles?`, "bg-brand-green text-brand-cream whitespace-nowrap")}
                </div>
              )}

              {estado === "listo" && (
                <>
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
                            key={h.hora}
                            type="button"
                            onClick={() => setHoraElegida(h.hora)}
                            className={`rounded-xl border-2 py-2.5 text-base font-bold tabular-nums transition-colors ${
                              h.hora === horaActiva ? "border-brand-green bg-brand-green text-brand-cream" : "border-brand-tan bg-white text-brand-charcoal hover:border-brand-green"
                            }`}
                          >
                            {h.hora}
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
                      <p className="text-sm text-brand-charcoal/75">
                        {motivo.nombre}
                        {conQuien.length > 0 ? ` · te atiende ${conQuien.join(" o ")}` : ""}
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-brand-charcoal/80">Nombre y apellido</span>
                          <input className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" required maxLength={80} />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-brand-charcoal/80">Tu WhatsApp</span>
                          <input className={campo} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="341 555 1234" required maxLength={20} />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-brand-charcoal/80">Obra social</span>
                          <input
                            className={campo}
                            list="obras-sociales-publicas"
                            value={obraSocial}
                            onChange={(e) => setObraSocial(e.target.value)}
                            placeholder="Elegí tu obra social o escribí «Particular»"
                            maxLength={60}
                          />
                          <datalist id="obras-sociales-publicas">
                            <option value="Particular (sin obra social)" />
                            {datos.obrasSociales.map((o) => (
                              <option key={o} value={o} />
                            ))}
                          </datalist>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-brand-charcoal/80">
                            Número de documento (DNI){" "}
                            <span className="text-brand-charcoal/50">{esPaciente ? "— para encontrar tu ficha" : "(opcional)"}</span>
                          </span>
                          <input
                            className={campo}
                            value={dni}
                            onChange={(e) => setDni(e.target.value.replace(/[^\d.]/g, ""))}
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="Sin puntos, por ejemplo 30123456"
                            required={esPaciente}
                            maxLength={11}
                          />
                        </label>
                      </div>
                      <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-brand-charcoal/85">
                        <input type="checkbox" checked={esPaciente} onChange={(e) => setEsPaciente(e.target.checked)} className="mt-1 h-4 w-4 accent-brand-green" />
                        <span>Ya soy paciente de la clínica</span>
                      </label>
                      <input
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        value={trampa}
                        onChange={(e) => setTrampa(e.target.value)}
                        name="sitioWeb"
                        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                      />
                      <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm text-brand-charcoal/85">
                        <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1 h-4 w-4 accent-brand-green" />
                        <span>Acepto que la clínica me escriba por WhatsApp para confirmar el turno.</span>
                      </label>
                      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
                      <button
                        type="submit"
                        disabled={enviando || !acepta || !nombre.trim() || !whatsapp.trim() || (esPaciente && !dni.trim())}
                        className="mt-4 w-full rounded-full bg-brand-green px-6 py-3.5 text-base font-bold text-brand-cream transition-opacity disabled:opacity-50 sm:w-auto"
                      >
                        {enviando ? "Enviando…" : "Pedir este turno"}
                      </button>
                    </form>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {hecho && (
        <div className="mt-4 rounded-2xl bg-brand-mint/30 p-5 ring-1 ring-brand-mint">
          <p className="font-heading text-2xl font-extrabold text-brand-green">¡Listo, {hecho.nombre.split(" ")[0]}!</p>
          <p className="mt-1 text-brand-charcoal/90">
            Pediste turno para el <strong>{hecho.texto}</strong> ({hecho.motivo}
            {hecho.con ? `, con ${hecho.con}` : ""}). Te vamos a escribir por WhatsApp para confirmarlo. Si querés, también podés escribirnos vos ahora.
          </p>
          <div className="mt-4">
            {botonWhatsApp(`¡Hola! Soy ${hecho.nombre}. Acabo de pedir turno de odontología (${hecho.motivo}) para el ${hecho.texto} desde la página.`, "bg-brand-green text-brand-cream")}
          </div>
          <p className="mt-3 text-xs text-brand-charcoal/60">WhatsApp {WHATSAPP_CLINICA_VISIBLE}</p>
        </div>
      )}
    </div>
  );
}
