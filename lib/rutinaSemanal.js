// Rutina semanal de las dueñas (Gerencial → Mi rutina semanal).
//
// Cada jornada tiene cinco bloques: arranque, foco (el tema del día), punto medio, equipo y seguimiento, y cierre.
// Hay dos turnos: la TARDE (llega a las 14:00 y se queda hasta el cierre, 19:00) y la MAÑANA (de 9:00 a 14:00).
// En la mañana el último bloque es el «cierre de mi turno», porque el cierre de la clínica queda en manos de Secretaría.
// Los tiempos (`desde`, `min`) son minutos desde la hora de llegada. Los temas de cada día y las tareas del mes son
// una propuesta armada con lo que tiene la app.

export const TURNOS = {
  tarde: {
    nombre: "Tarde",
    inicio: 14 * 60,
    fases: [
      { id: "arranque", nombre: "Arranque", sub: "Al llegar", desde: 0, min: 40 },
      { id: "foco", nombre: "Bloque de foco", sub: "Tema del día", desde: 40, min: 100 },
      { id: "medio", nombre: "Punto medio", sub: "Media jornada", desde: 140, min: 20 },
      { id: "equipo", nombre: "Equipo y seguimiento", sub: "Gente y pendientes", desde: 160, min: 80 },
      { id: "cierre", nombre: "Cierre del día", sub: "Antes de irme", desde: 240, min: 60 },
    ],
  },
  manana: {
    nombre: "Mañana",
    inicio: 9 * 60,
    fases: [
      { id: "arranque", nombre: "Arranque", sub: "Al llegar", desde: 0, min: 40 },
      { id: "foco", nombre: "Bloque de foco", sub: "Tema del día", desde: 40, min: 120 },
      { id: "medio", nombre: "Punto medio", sub: "Media jornada", desde: 160, min: 20 },
      { id: "equipo", nombre: "Equipo y seguimiento", sub: "Gente y pendientes", desde: 180, min: 70 },
      { id: "cierre", nombre: "Cierre de mi turno", sub: "Antes de las 14:00", desde: 250, min: 50 },
    ],
  },
};

// Tareas que se repiten todos los días, según el turno.
export const COMUNES = {
  tarde: {
    arranque: [
      { t: "Qué revisar: dejarlo en cero o anotar qué queda abierto", min: 8, donde: "Gerencial → Qué revisar" },
      { t: "Agenda de hoy: huecos, turnos largos (endodoncias 120 min), consentimientos «Falta firmar»", min: 10, donde: "Agenda" },
      { t: "¿Quedó aprobado el Cierre Diario de ayer? Si fue martes o viernes, aprobarlo ahora", min: 5, donde: "Gerencial → Cierre Diario" },
      { t: "Chat y Autorizaciones: responder solo lo urgente", min: 7, donde: "Chat · Autorizaciones" },
      { t: "Mini reunión de pie con Simón y Lola: prioridades, faltantes de la mañana, turnos sin marcar", min: 5, donde: "Recepción" },
      { t: "Escribir mis 3 prioridades del día", min: 5, donde: "Acá arriba, en «Mis 3 prioridades»" },
    ],
    medio: [
      { t: "Plata de hoy hasta ahora: ¿lo cobrado coincide con lo que se atendió?", min: 8, donde: "Gerencial → Detalle del día" },
      { t: "Turnos sin asistencia marcada o sin cobro: que se resuelvan ahora", min: 4, donde: "Agenda · Caja" },
      { t: "Pagos a profesionales de hoy: ¿con pacientes tildados?", min: 3, donde: "Caja → Pago a profesional" },
      { t: "Confirmar los turnos de mañana por WhatsApp", min: 3, donde: "Agenda" },
      { t: "Mis 3 prioridades: ¿cuál sigue? Reordenar lo que queda", min: 2, donde: "Acá arriba" },
    ],
    cierre: [
      { t: "Cierre de turno de Secretaría hecho (General y Ortodoncia)", min: 10, donde: "Cierre de turno" },
      { t: "Cierre Diario: revisar números y aprobar", min: 15, donde: "Gerencial → Cierre Diario" },
      { t: "Detalle del día: ¿coincide lo que entró con lo que sumó al balance?", min: 10, donde: "Gerencial → Detalle del día" },
      { t: "En Caja, mirar los «⏳ Falta liquidar» del día y decidir cuándo se pagan", min: 5, donde: "Caja" },
      { t: "Agenda de mañana: duración de cada turno, huecos, cambios de profesional", min: 10, donde: "Agenda" },
      { t: "Anotar las 3 prioridades de mañana y lo que queda pendiente; avisar al equipo", min: 10, donde: "Acá abajo, en «Pendientes del cierre»" },
    ],
  },
  manana: {
    arranque: [
      { t: "Qué revisar: dejarlo en cero o anotar qué queda abierto", min: 8, donde: "Gerencial → Qué revisar" },
      { t: "Agenda de hoy: huecos, turnos largos (endodoncias 120 min), consentimientos «Falta firmar»", min: 10, donde: "Agenda" },
      { t: "¿Quedó aprobado el Cierre Diario de ayer? Aprobarlo ahora", min: 5, donde: "Gerencial → Cierre Diario" },
      { t: "Chat y Autorizaciones: responder solo lo urgente", min: 7, donde: "Chat · Autorizaciones" },
      { t: "Mini reunión de pie con Simón y Lola: prioridades, faltantes de ayer, turnos sin marcar", min: 5, donde: "Recepción" },
      { t: "Escribir mis 3 prioridades del día", min: 5, donde: "Acá arriba, en «Mis 3 prioridades»" },
    ],
    medio: [
      { t: "Plata de hoy hasta ahora: ¿lo cobrado coincide con lo que se atendió?", min: 8, donde: "Gerencial → Detalle del día" },
      { t: "Turnos sin asistencia marcada o sin cobro: que se resuelvan ahora", min: 4, donde: "Agenda · Caja" },
      { t: "Pagos a profesionales de la mañana: ¿con pacientes tildados?", min: 3, donde: "Caja → Pago a profesional" },
      { t: "Confirmar los turnos de la tarde y de mañana por WhatsApp", min: 3, donde: "Agenda" },
      { t: "Mis 3 prioridades: ¿cuál sigue? Reordenar lo que queda", min: 2, donde: "Acá arriba" },
    ],
    cierre: [
      { t: "Detalle del día hasta ahora: anotar si algo no cierra", min: 10, donde: "Gerencial → Detalle del día" },
      { t: "Dejar por escrito a Simón y Lola qué queda para la tarde y el cierre", min: 10, donde: "Chat" },
      { t: "Pagos a profesionales y «⏳ Falta liquidar» de la mañana", min: 10, donde: "Caja" },
      { t: "Agenda de mañana: duración de cada turno, huecos, cambios de profesional", min: 10, donde: "Agenda" },
      { t: "Anotar las 3 prioridades de mañana y lo que queda pendiente", min: 5, donde: "Acá abajo, en «Pendientes del cierre»" },
      { t: "Cerrar el día: aprobar hoy el Cierre Diario desde el celular, o mañana al llegar", min: 5, donde: "Gerencial → Cierre Diario" },
    ],
  },
};

// Tema de cada día. `turno` es el turno habitual. El miércoles es de tarde, pero puede pasarse a la mañana
// cuando haga falta, así que su foco y su equipo entran en los dos turnos.
export const DIAS = [
  {
    corto: "Lun",
    largo: "Lunes",
    turno: "tarde",
    gym: true,
    tema: "Semana y Ortodoncia",
    lema: "Ordenar la semana y a los pacientes de ortodoncia.",
    foco: [
      { t: "Seguimiento de Ortodoncia: quién no tiene turno este mes y quién ya tiene más adelante", min: 25, donde: "Gerencial → Seguimiento de Ortodoncia" },
      { t: "Aumentos de ortodoncia vencidos: revisar y decidir", min: 15, donde: "Gerencial → Aumentos de ortodoncia" },
      { t: "Tarjeta de fidelidad y plan de referidos: premios por usar esta semana", min: 10, donde: "Ortodoncia → Fidelidad · Referidos" },
      { t: "Agenda de la semana: huecos, turnos largos, horarios de profesionales", min: 25, donde: "Agenda · Gerencial → Horarios" },
      { t: "Metas y seguimiento: definir las 3 metas de la semana", min: 15, donde: "Metas y Seguimiento" },
    ],
    equipo: [
      { t: "Retomar: escribir a los que faltaron y «vienen seguido» (10 a 15 mensajes)", min: 40, donde: "Ortodoncia → Retomar" },
      { t: "Limpieza de pacientes: revisar a los que parecen haber dejado de venir", min: 15, donde: "Ortodoncia → Limpieza" },
      { t: "Reunión corta con Marianela y Virginia: casos y pendientes de ortodoncia", min: 25, donde: "Consultorio" },
    ],
  },
  {
    corto: "Mar",
    largo: "Martes",
    turno: "manana",
    tema: "Liquidaciones y pagos",
    lema: "Que lo que se le debe a cada profesional coincida, paciente por paciente.",
    foco: [
      { t: "Pestaña «Pacientes liquidados y pendientes»: ¿coincide con lo que dice Producción?", min: 40, donde: "Gerencial → Liquidaciones por profesional" },
      { t: "Registrar los pagos pendientes tildando pacientes (total o una parte)", min: 40, donde: "Gerencial → Producción y liquidación" },
      { t: "Historial de pagos: ¿quién cargó qué y cuándo?", min: 15, donde: "Gerencial → Historial de pagos" },
      { t: "Cuentas Galicia y Mercado Pago: saldos al día", min: 15, donde: "Gerencial → Cuentas" },
    ],
    equipo: [
      { t: "Reunión con Ane: gastos cargados, reserva, pagos por transferencia", min: 40, donde: "Con Ane" },
      { t: "Gastos recurrentes: ¿falta cargar alguno?", min: 15, donde: "Gastos recurrentes" },
      { t: "Consultorio (reserva): movimientos de la semana", min: 15, donde: "Gerencial → Consultorio (reserva)" },
    ],
  },
  {
    corto: "Mié",
    largo: "Miércoles",
    turno: "tarde",
    tema: "Obras sociales",
    lema: "Autorizar, controlar y cobrar lo de las obras sociales.",
    foco: [
      { t: "Autorizaciones pendientes: reclamar las que no avanzan", min: 25, donde: "Autorizaciones" },
      { t: "Control de Obras Sociales: lo facturado contra lo atendido", min: 35, donde: "Gerencial → Control de Obras Sociales" },
      { t: "Fichas Entre Ríos (Swiss Medical, Osde, Sancor)", min: 20, donde: "Gerencial → Fichas Entre Ríos" },
      { t: "Cruce con ASOR y Pagos ASOR", min: 20, donde: "Gerencial → Cruce con ASOR · Pagos ASOR" },
    ],
    equipo: [
      { t: "Cuentas por cobrar y planes de financiación: escribir a quien tiene cuotas vencidas", min: 30, donde: "Cuentas por cobrar · Planes" },
      { t: "Presupuestos pendientes: seguimiento a los que no respondieron", min: 20, donde: "Presupuestos" },
      { t: "Fichas con plan de obra social o condición de IVA «sin cargar»: pedir el dato", min: 15, donde: "Pacientes" },
    ],
  },
  {
    corto: "Jue",
    largo: "Jueves",
    turno: "tarde",
    gym: true,
    tema: "Marca y equipo",
    lema: "Que la clínica se vea y se comunique como quiere ser.",
    foco: [
      { t: "Calendario de contenido con Lourdes: aprobar los posteos de la semana que viene", min: 35, donde: "Calendario de Contenido" },
      { t: "Biblioteca de marca: ¿se usa lo oficial (logo, colores, tipografías)?", min: 15, donde: "Biblioteca de marca" },
      { t: "Cartel y QR de beneficios en recepción: ¿están a la vista?", min: 5, donde: "Recepción" },
      { t: "Metas del mes: cómo vamos", min: 15, donde: "Metas y Seguimiento" },
    ],
    equipo: [
      { t: "Uno a uno con un profesional (uno por semana): feedback, horarios, dudas", min: 45, donde: "Consultorio" },
      { t: "Historias clínicas y consentimientos incompletos: pedir que se completen", min: 25, donde: "Pacientes → Mostrar solo incompletos · Consentimientos" },
      { t: "Manuales de Secretaría y Odontólogos: ¿hay algo para actualizar?", min: 10, donde: "Documentos" },
    ],
  },
  {
    corto: "Vie",
    largo: "Viernes",
    turno: "manana",
    tema: "Cierre de la semana",
    lema: "Cerrar números, insumos y pendientes para arrancar el lunes limpio.",
    foco: [
      { t: "Balance Mensual al día", min: 25, donde: "Gerencial → Balance Mensual" },
      { t: "Lo que queda limpio: revisar la semana", min: 25, donde: "Gerencial → Lo que queda limpio" },
      { t: "Stock de insumos y pedidos; trabajos de laboratorio con Yamila", min: 40, donde: "Stock de Insumos · Laboratorio" },
      { t: "Gastos de la semana cargados", min: 15, donde: "Gastos de la Clínica" },
    ],
    equipo: [
      { t: "Revisión de la semana: 3 cosas que salieron bien y 3 que no", min: 20, donde: "Acá abajo, en «Pendientes del cierre»" },
      { t: "Qué revisar en cero antes de irme", min: 20, donde: "Gerencial → Qué revisar" },
      { t: "Planificar la semana que viene: elegir los 3 temas", min: 20, donde: "Metas y Seguimiento" },
      { t: "Los pendientes que pasan al lunes: anotados con fecha", min: 10, donde: "Acá abajo" },
    ],
  },
];

export const MES = [
  { cuando: "Días 1 a 3", titulo: "Cierre de mes", items: ["Cerrar el mes y revisar el Balance Mensual", "Conciliar los bancos en Cuentas", "Sueldos con Ane"], donde: "Gerencial → Cierre de Mes · Balance Mensual · Cuentas" },
  { cuando: "Día 5", titulo: "Obras sociales a mes vencido", items: ["Facturación a obras sociales del mes anterior", "Liquidar honorarios de obra social a los profesionales"], donde: "Gerencial → Control de Obras Sociales · Producción y liquidación" },
  { cuando: "Día 10", titulo: "Aumentos de ortodoncia", items: ["Revisar las cuotas con aumento vencido", "Avisar a los secretarios cuáles cambian"], donde: "Gerencial → Aumentos de ortodoncia" },
  { cuando: "Día 15", titulo: "Mitad de mes", items: ["Metas: cómo vamos", "Limpieza de pacientes de ortodoncia"], donde: "Metas y Seguimiento · Ortodoncia → Limpieza" },
  { cuando: "Día 20", titulo: "Reserva y gastos fijos", items: ["Control de gastos recurrentes", "Movimientos de la reserva del Consultorio", "Pedido grande de insumos"], donde: "Gastos recurrentes · Consultorio (reserva) · Stock" },
  { cuando: "Último día", titulo: "Antes de cerrar el mes", items: ["Balance al día, sin pendientes de carga", "Planificar el mes que viene", "Cartel y tarjetas de beneficios: ¿reponer?"], donde: "Gerencial → Balance Mensual" },
];

export const REGLAS = [
  { t: "Tres prioridades por día, no diez", d: "Las escribís al llegar y las revisás en el punto medio. Si algo nuevo entra, algo sale." },
  { t: "La plata se mira dos veces, no todo el día", d: "Punto medio y cierre. Entre medio, la secretaría carga y vos no controlás cada cobro." },
  { t: "Mensajes en tres ventanas", d: "Al llegar, en el punto medio y en el cierre. Fuera de eso, solo lo urgente de verdad." },
  { t: "Cada tema, su día", d: "Liquidaciones el martes, obras sociales el miércoles. Si hoy no toca, anotalo en el día que toca y soltalo." },
  { t: "Lo que se puede delegar, se delega con fecha", d: "Simón y Lola cierran turnos y cargan datos; Ane, gastos y reserva; Lourdes, contenido. Vos revisás." },
  { t: "Cerrar el día es parte del trabajo", d: "Si el cierre se saltea, mañana arranca con deuda. Ese bloque no se negocia." },
];

// Tareas de un bloque para un día y un turno.
export function tareasDe(faseId, dia, turno) {
  if (faseId === "foco") return dia.foco;
  if (faseId === "equipo") return dia.equipo;
  return COMUNES[turno][faseId] || [];
}
