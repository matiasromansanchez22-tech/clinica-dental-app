"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerActividadDelDia } from "@/lib/data/estadisticas";
import { obtenerTurnosSinCerrarHoy } from "@/lib/data/cierres";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatoFechaLarga(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  const texto = `${DIAS[fecha.getDay()]} ${dia} de ${MESES[mes - 1]}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const ACCESOS_POR_ROL = {
  Duena: [
    { href: "/agenda", icon: "📅", label: "Agenda General" },
    { href: "/ortodoncia/agenda", icon: "🦷", label: "Agenda Ortodoncia" },
    { href: "/caja", icon: "💰", label: "Caja" },
    { href: "/gerencial/cierre-diario", icon: "🔒", label: "Cierre Diario" },
    { href: "/gerencial/estadisticas", icon: "📊", label: "Tablero Mensual" },
    { href: "/gerencial/metas", icon: "🎯", label: "Metas y Seguimiento" },
    { href: "/gastos-recurrentes", icon: "💼", label: "Gastos de la Clínica" },
    { href: "/pacientes", icon: "🧑‍⚕️", label: "Pacientes General" },
    { href: "/ortodoncia/pacientes", icon: "🦷", label: "Pacientes Ortodoncia" },
  ],
  Secretaria: [
    { href: "/agenda", icon: "📅", label: "Agenda General" },
    { href: "/ortodoncia/agenda", icon: "🦷", label: "Agenda Ortodoncia" },
    { href: "/caja", icon: "💰", label: "Caja" },
    { href: "/cierre-turno", icon: "🔒", label: "Cierre de Turno" },
    { href: "/pacientes", icon: "🧑‍⚕️", label: "Pacientes General" },
    { href: "/ortodoncia/pacientes", icon: "🦷", label: "Pacientes Ortodoncia" },
    { href: "/presupuestos", icon: "📋", label: "Presupuestos" },
  ],
  Odontologo: [
    { href: "/agenda", icon: "📅", label: "Agenda General" },
    { href: "/pacientes", icon: "🧑‍⚕️", label: "Pacientes General" },
    { href: "/ortodoncia/pacientes", icon: "🦷", label: "Pacientes Ortodoncia" },
    { href: "/presupuestos", icon: "📋", label: "Presupuestos" },
    { href: "/catalogo", icon: "📖", label: "Catálogo" },
  ],
  Laboratorio: [
    { href: "/laboratorio", icon: "🔧", label: "Trabajos de laboratorio" },
    { href: "/gerencial/stock", icon: "📦", label: "Stock de Insumos" },
    { href: "/horario", icon: "🕐", label: "Mi horario" },
  ],
  Contador: [
    { href: "/caja", icon: "💰", label: "Caja General" },
    { href: "/ortodoncia/caja", icon: "🦷", label: "Caja Ortodoncia" },
    { href: "/gerencial/gastos", icon: "🧾", label: "Gastos" },
    { href: "/gerencial/balance-mensual", icon: "📊", label: "Balance Mensual" },
  ],
  CM: [
    { href: "/calendario-contenido", icon: "📅", label: "Calendario de Contenido" },
    { href: "/biblioteca-marca", icon: "🎨", label: "Biblioteca de marca" },
    { href: "/panoramicas", icon: "🩻", label: "Pano y fotos" },
  ],
};

function TarjetaAcceso({ href, icon, label }) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-3 rounded-2xl border border-brand-tan/70 bg-white p-5 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-brand-brown hover:shadow-lg"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-tan/40 text-2xl transition-colors group-hover:bg-brand-brown group-hover:text-white">
        {icon}
      </span>
      <span className="text-sm font-semibold text-brand-charcoal group-hover:text-brand-brown">{label}</span>
    </Link>
  );
}

function TarjetaStat({ etiqueta, valor, icon }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-mint/25 text-lg">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium leading-tight uppercase tracking-wide text-gray-400">{etiqueta}</p>
        <p className="mt-0.5 font-heading text-xl font-bold text-brand-brown">{valor}</p>
      </div>
    </div>
  );
}

// Solo para la Dueña: un vistazo rápido de cómo viene el día, y un aviso
// si algún secretario ya marcó su salida y dejó la caja de alguna
// especialidad sin cerrar (mismo chequeo que el punto rojo del menú).
function ResumenDelDia() {
  const hoy = fechaDeHoyISO();
  const [actividad, setActividad] = useState(null);
  const [avisoCierre, setAvisoCierre] = useState(null);

  useEffect(() => {
    obtenerActividadDelDia(hoy)
      .then(setActividad)
      .catch(() => {});
    obtenerTurnosSinCerrarHoy()
      .then(({ general, ortodoncia }) => {
        const faltantes = [];
        if (general) faltantes.push("Odontología General");
        if (ortodoncia) faltantes.push("Ortodoncia");
        setAvisoCierre(faltantes.length > 0 ? faltantes : null);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!actividad) return null;

  return (
    <div className="mt-10 w-full">
      <h2 className="mb-3 flex items-center gap-2 text-left font-heading text-sm font-bold uppercase tracking-wide text-brand-brown/70">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-mint" />
        Hoy
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TarjetaStat etiqueta="Pacientes nuevos" valor={actividad.pacientesNuevosTotal} icon="🧑‍⚕️" />
        <TarjetaStat etiqueta="Turnos atendidos" valor={actividad.turnosAtendidosTotal} icon="📅" />
        <TarjetaStat etiqueta="Cobrado hoy" valor={`$${Math.round(actividad.cobradoHoy).toLocaleString("es-AR")}`} icon="💰" />
        <TarjetaStat etiqueta="Cobros" valor={actividad.cantidadCobrosHoy} icon="🧾" />
      </div>
      {avisoCierre && (
        <Link
          href="/gerencial/cierre-diario"
          className="mt-3 block rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
        >
          ⚠️ Todavía falta cerrar el turno de {avisoCierre.join(" y ")} — revisar en Cierre Diario →
        </Link>
      )}
    </div>
  );
}

export default function Home() {
  const { perfil } = useAuth();
  const nombre = perfil?.nombre?.split(" ")[0] || "";
  const accesos = ACCESOS_POR_ROL[perfil?.rol] || ACCESOS_POR_ROL.Secretaria;

  return (
    <main className="mx-auto flex max-w-4xl flex-col items-center gap-1 px-4 pb-10 sm:px-6">
      <div className="flex w-full flex-col items-center gap-1 rounded-b-3xl bg-gradient-to-b from-brand-tan/35 via-brand-tan/10 to-transparent px-6 pb-8 pt-9 text-center sm:pt-12">
        <Image src="/brand/logo-claro.png" alt="Clínica Dental Marianela Ramírez" width={84} height={84} priority />
        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-brand-brown/55">
          {formatoFechaLarga(fechaDeHoyISO())}
        </p>
        <h1 className="mt-1 font-heading text-3xl font-bold text-brand-brown sm:text-4xl">
          {nombre ? `Hola, ${nombre} 👋` : "Clínica Dental Marianela Ramírez"}
        </h1>
      </div>

      <div className="mt-8 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {accesos.map((a) => (
          <TarjetaAcceso key={a.href} {...a} />
        ))}
      </div>

      {perfil?.rol === "Duena" && <ResumenDelDia />}
    </main>
  );
}
