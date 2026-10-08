"use client";

import SoloDuena from "@/components/SoloDuena";

// Foto de "quién ve qué" armada revisando el menú, las pantallas con acceso
// restringido y los permisos de la base de datos. No se actualiza sola: si se
// cambia algún permiso, hay que actualizar esta tabla.
const FECHA_REVISION = "8 de octubre de 2026";

const ROLES = [
  { clave: "D", nombre: "Dueñas" },
  { clave: "S", nombre: "Secretaria" },
  { clave: "O", nombre: "Odontólogo" },
  { clave: "L", nombre: "Laboratorio" },
  { clave: "C", nombre: "Contador (Ane)" },
  { clave: "M", nombre: "Marketing" },
];

// ok = accede · ro = solo lectura · no = no accede · aviso = accede y conviene
// revisarlo · propio = ve solo lo que cargó ella/él
const SIMBOLOS = {
  ok: { texto: "✓", clase: "bg-emerald-100 text-emerald-800", titulo: "Accede" },
  ro: { texto: "👁", clase: "bg-sky-100 text-sky-800", titulo: "Solo lectura" },
  no: { texto: "—", clase: "bg-gray-100 text-gray-400", titulo: "No accede" },
  aviso: { texto: "⚠", clase: "bg-amber-100 text-amber-800", titulo: "Accede — conviene revisarlo" },
  propio: { texto: "◐", clase: "bg-violet-100 text-violet-800", titulo: "Ve solo lo suyo" },
};

// Cada fila: [pantalla, D, S, O, L, C, M, nota opcional]
const SECCIONES = [
  {
    titulo: "Para todos",
    filas: [
      ["Inicio y cambiar contraseña", "ok", "ok", "ok", "ok", "ok", "ok"],
      ["Chat interno", "ok", "ok", "ok", "ok", "no", "ok"],
      ["Panorámicas y fotos", "ok", "ok", "ok", "ok", "no", "ok"],
      ["Mi horario (marcar entrada y salida)", "ok", "ok", "no", "ok", "no", "no"],
    ],
  },
  {
    titulo: "Odontología General y Ortodoncia (la parte clínica)",
    filas: [
      ["Agenda, turnos a reprogramar y cancelados", "ok", "ok", "ok", "ok", "no", "no"],
      ["Pacientes (fichas)", "ok", "ok", "ok", "ok", "no", "no"],
      ["Presupuestos, planes, catálogo y nomenclador", "ok", "ok", "ok", "ok", "no", "no"],
      ["Controles de Ortodoncia", "ok", "ok", "ok", "ok", "no", "no"],
      ["Autorizaciones de obras sociales", "ok", "ok", "no", "no", "no", "no"],
      ["Trabajos de laboratorio", "ok", "no", "ok", "ok", "no", "no"],
      ["Stock de insumos", "ok", "ok", "no", "ok", "no", "no"],
    ],
  },
  {
    titulo: "Cobros y cajas",
    filas: [
      [
        "Caja General y Caja Ortodoncia",
        "ok",
        "ok",
        "no",
        "no",
        "ro",
        "no",
        "Desde el 7/10 el Odontólogo y Laboratorio no la ven en el menú y la pantalla les dice \"Acceso restringido\".",
      ],
      [
        "Cuentas por cobrar y Cierre de Turno",
        "ok",
        "ok",
        "no",
        "no",
        "no",
        "no",
        "Mismo caso: bloqueadas para el Odontólogo y Laboratorio.",
      ],
      ["Contador de billetes", "ok", "ok", "no", "no", "ok", "no", "La secretaria lo usa dentro de su Cierre de Turno."],
    ],
  },
  {
    titulo: "Finanzas (Ane las ve en solo lectura, salvo gastos y Consultorio, que también carga)",
    filas: [
      [
        "Gastos y Gastos de la Clínica",
        "ok",
        "no",
        "no",
        "no",
        "ok",
        "no",
        "Ane carga y corrige gastos de meses sin cerrar, y marca los pagos de Gastos de la Clínica. No edita la lista de gastos fijos.",
      ],
      [
        "Consultorio (la reserva): saldo, movimientos, sueldos de empleados y conciliar banco",
        "ok",
        "no",
        "no",
        "no",
        "ok",
        "no",
        "Ane ve solo el panel Consultorio. El Personal de cada dueña es privado y no lo puede ver. El sueldo de una dueña lo carga una Dueña.",
      ],
      ["Cierre Diario y Cierre de Mes", "ok", "no", "no", "no", "ro", "no"],
      ["Balance Mensual y Balance Anual", "ok", "no", "no", "no", "ro", "no"],
      ["Lo que queda limpio", "ok", "no", "no", "no", "ro", "no"],
      ["Control de Obras Sociales y Fichas Entre Ríos", "ok", "no", "no", "no", "ro", "no"],
      ["Pagos ASOR", "ok", "no", "no", "no", "ro", "no"],
      ["Horarios y liquidación del personal", "ok", "no", "no", "no", "ro", "no"],
      [
        "Producción y liquidación",
        "ok",
        "propio",
        "no",
        "no",
        "ro",
        "no",
        "La secretaria ve su parte, sin los honorarios de los profesionales.",
      ],
    ],
  },
  {
    titulo: "Marketing",
    filas: [["Calendario de contenido y Biblioteca de marca", "ok", "no", "no", "no", "no", "ok"]],
  },
  {
    titulo: "Solo las Dueñas",
    filas: [
      ["Tablero Mensual y Metas", "ok", "no", "no", "no", "no", "no"],
      ["Personal (la plata de cada dueña)", "ok", "no", "no", "no", "no", "no", "Cada dueña ve solo su Personal."],
      ["Casa y Catalina", "ok", "no", "no", "no", "no", "no"],
      ["Comparativa y cuentas por mecánico, rentabilidad, ranking y registro por profesional", "ok", "no", "no", "no", "no", "no"],
      ["Profesionales, aumentos de Ortodoncia y pedidos de insumos", "ok", "no", "no", "no", "no", "no"],
      ["Papelera, Accesos, Errores y Bandeja de WhatsApp", "ok", "no", "no", "no", "no", "no"],
    ],
  },
  {
    titulo: "Datos privados",
    filas: [
      [
        "Conteos de billetes guardados (historial)",
        "ok",
        "propio",
        "no",
        "no",
        "propio",
        "no",
        "Las Dueñas ven todos; cada persona, solo los suyos.",
      ],
    ],
  },
];

const AVISOS = [
  {
    titulo: "La plata ya está protegida para el Odontólogo y Laboratorio",
    texto:
      "Desde el 7/10, Caja, Cuentas por cobrar y Cierre de Turno no aparecen en su menú, la pantalla les dice \"Acceso restringido\" y además la base de datos no les deja leer ni cargar cobros, gastos, pagos a profesionales ni cierres. Lo que arman ellos (presupuestos y planes) sigue visible para ellos.",
  },
  {
    titulo: "Secretaria: ve toda la plata de las cajas",
    texto:
      "La Secretaria necesita cobrar, así que la base le permite leer y cargar cobros, gastos, pagos y cierres de todas las cajas, aunque su menú no le muestre Gastos ni los balances. Es una decisión a tener en cuenta si alguna vez querés afinarlo más.",
  },
  {
    titulo: "Ane ve los cierres de turno con lo que contó cada una",
    texto:
      "En el Cierre Diario, Ane ve el cierre de cada secretaria y si le sobró o le faltó efectivo. Si querés que eso quede solo para las Dueñas, se puede cambiar.",
  },
];

function Celda({ tipo }) {
  const s = SIMBOLOS[tipo];
  return (
    <td className="px-1.5 py-2 text-center">
      <span
        title={s.titulo}
        className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-sm font-semibold ${s.clase}`}
      >
        {s.texto}
      </span>
    </td>
  );
}

function QuienVeQueContenido() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🔐 Quién ve qué</h1>
      <p className="mt-1 text-sm text-gray-500">
        Qué pantalla puede abrir cada rol. Revisado el {FECHA_REVISION}; no se actualiza sola, así que si se cambia algún
        permiso hay que actualizar esta tabla.
      </p>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-600">
        {Object.entries(SIMBOLOS).map(([clave, s]) => (
          <span key={clave} className="flex items-center gap-1.5">
            <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded px-1 font-semibold ${s.clase}`}>
              {s.texto}
            </span>
            {s.titulo}
          </span>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Pantalla</th>
              {ROLES.map((r) => (
                <th key={r.clave} className="px-1.5 py-2 text-center text-xs font-semibold">
                  {r.nombre}
                </th>
              ))}
            </tr>
          </thead>
          {SECCIONES.map((seccion) => (
            <tbody key={seccion.titulo}>
              <tr className="bg-brand-tan/30">
                <td colSpan={ROLES.length + 1} className="px-3 py-1.5 text-xs font-semibold uppercase text-brand-brown">
                  {seccion.titulo}
                </td>
              </tr>
              {seccion.filas.map(([pantalla, ...resto]) => {
                const nota = resto.length > ROLES.length ? resto[ROLES.length] : null;
                return (
                  <tr key={pantalla} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-800">
                      {pantalla}
                      {nota && <span className="mt-0.5 block text-[11px] text-gray-400">{nota}</span>}
                    </td>
                    {resto.slice(0, ROLES.length).map((tipo, i) => (
                      <Celda key={ROLES[i].clave} tipo={tipo} />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>

      <h2 className="mt-8 font-heading text-sm font-semibold text-brand-brown">Para revisar</h2>
      <div className="mt-2 flex flex-col gap-3">
        {AVISOS.map((a) => (
          <div key={a.titulo} className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900">⚠ {a.titulo}</p>
            <p className="mt-1 text-sm text-amber-800">{a.texto}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

export default function QuienVeQuePage() {
  return (
    <SoloDuena>
      <QuienVeQueContenido />
    </SoloDuena>
  );
}
