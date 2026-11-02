// Rutina semanal de la dueña (Gerencial → Mi rutina semanal): jornada de lunes a viernes dividida en arranque, foco, punto medio,
// almuerzo, equipo y cierre. Los temas de cada día y las tareas del mes son una propuesta armada con lo que tiene la app.
// Los tiempos (`desde`, `min`) son minutos desde la hora de llegada.
export const RUTINA = {
  "fases": [
    {
      "id": "arranque",
      "nombre": "Arranque",
      "sub": "Al llegar",
      "desde": 0,
      "min": 45
    },
    {
      "id": "foco",
      "nombre": "Bloque de foco",
      "sub": "Tema del día",
      "desde": 45,
      "min": 165
    },
    {
      "id": "medio",
      "nombre": "Punto medio",
      "sub": "Media jornada",
      "desde": 210,
      "min": 30
    },
    {
      "id": "pausa",
      "nombre": "Almuerzo",
      "sub": "Pausa real, sin pantalla",
      "desde": 240,
      "min": 60
    },
    {
      "id": "bloque2",
      "nombre": "Equipo y seguimiento",
      "sub": "Gente y pendientes",
      "desde": 300,
      "min": 150
    },
    {
      "id": "cierre",
      "nombre": "Cierre del día",
      "sub": "Antes de irme",
      "desde": 450,
      "min": 60
    }
  ],
  "comunes": {
    "arranque": [
      {
        "t": "Qué revisar: dejarlo en cero o anotar qué queda abierto",
        "min": 10,
        "donde": "Gerencial → Qué revisar"
      },
      {
        "t": "Agenda de hoy: huecos, turnos largos (endodoncias 120 min), consentimientos «Falta firmar»",
        "min": 10,
        "donde": "Agenda"
      },
      {
        "t": "¿Quedó aprobado el Cierre Diario de ayer?",
        "min": 5,
        "donde": "Gerencial → Cierre Diario"
      },
      {
        "t": "Chat y Autorizaciones: responder solo lo urgente",
        "min": 10,
        "donde": "Chat · Autorizaciones"
      },
      {
        "t": "Mini reunión de pie con Simón y Lola: prioridades, faltantes de ayer, turnos sin marcar",
        "min": 5,
        "donde": "Recepción"
      },
      {
        "t": "Escribir mis 3 prioridades del día (las únicas que no se negocian)",
        "min": 5,
        "donde": "Papel o notas"
      }
    ],
    "medio": [
      {
        "t": "Plata de hoy hasta ahora: ¿lo cobrado coincide con lo que se atendió?",
        "min": 10,
        "donde": "Gerencial → Detalle del día"
      },
      {
        "t": "Turnos de la mañana sin asistencia marcada o sin cobro: que lo resuelvan ahora, no a la tarde",
        "min": 5,
        "donde": "Agenda · Caja"
      },
      {
        "t": "Pagos a profesionales de hoy: ¿con pacientes tildados? ¿alguno parcial?",
        "min": 5,
        "donde": "Caja → Pago a profesional"
      },
      {
        "t": "Confirmar los turnos de mañana por WhatsApp",
        "min": 5,
        "donde": "Agenda"
      },
      {
        "t": "Mis 3 prioridades: ¿cuál sigue? Reordenar la tarde",
        "min": 5,
        "donde": "Papel o notas"
      }
    ],
    "cierre": [
      {
        "t": "Cierre de turno de Secretaría hecho (General y Ortodoncia)",
        "min": 10,
        "donde": "Cierre de turno"
      },
      {
        "t": "Cierre Diario: revisar números y aprobar",
        "min": 15,
        "donde": "Gerencial → Cierre Diario"
      },
      {
        "t": "Detalle del día: ¿coincide lo que entró con lo que sumó al balance?",
        "min": 10,
        "donde": "Gerencial → Detalle del día"
      },
      {
        "t": "En Caja, mirar los «⏳ Falta liquidar» del día y decidir cuándo se pagan",
        "min": 5,
        "donde": "Caja"
      },
      {
        "t": "Agenda de mañana: duración de cada turno, huecos, cambios de profesional",
        "min": 10,
        "donde": "Agenda"
      },
      {
        "t": "Anotar las 3 prioridades de mañana, dejar los pendientes escritos y avisar al equipo",
        "min": 10,
        "donde": "Papel o notas"
      }
    ]
  },
  "dias": [
    {
      "corto": "Lun",
      "largo": "Lunes",
      "tema": "Semana y Ortodoncia",
      "lema": "Ordenar la semana y a los pacientes de ortodoncia.",
      "foco": [
        {
          "t": "Seguimiento de Ortodoncia: quién no tiene turno este mes y quién ya tiene más adelante",
          "min": 30,
          "donde": "Gerencial → Seguimiento de Ortodoncia"
        },
        {
          "t": "Aumentos de ortodoncia vencidos: revisar y decidir",
          "min": 20,
          "donde": "Gerencial → Aumentos de ortodoncia"
        },
        {
          "t": "Tarjeta de fidelidad y plan de referidos: premios por usar esta semana",
          "min": 15,
          "donde": "Ortodoncia → Fidelidad · Referidos"
        },
        {
          "t": "Agenda de la semana: huecos, turnos largos, horarios de profesionales",
          "min": 30,
          "donde": "Agenda · Gerencial → Horarios"
        },
        {
          "t": "Metas y seguimiento: definir las 3 metas de la semana",
          "min": 15,
          "donde": "Metas y Seguimiento"
        }
      ],
      "bloque2": [
        {
          "t": "Retomar: escribir a los que faltaron y «vienen seguido» (10 a 15 mensajes)",
          "min": 45,
          "donde": "Ortodoncia → Retomar"
        },
        {
          "t": "Limpieza de pacientes: revisar a los que parecen haber dejado de venir",
          "min": 30,
          "donde": "Ortodoncia → Limpieza"
        },
        {
          "t": "Reunión corta con Marianela y Virginia: casos y pendientes de ortodoncia",
          "min": 30,
          "donde": "Consultorio"
        }
      ]
    },
    {
      "corto": "Mar",
      "largo": "Martes",
      "tema": "Liquidaciones y pagos",
      "lema": "Que lo que se le debe a cada profesional coincida, paciente por paciente.",
      "foco": [
        {
          "t": "Pestaña «Pacientes liquidados y pendientes»: ¿coincide con lo que dice Producción?",
          "min": 45,
          "donde": "Gerencial → Liquidaciones por profesional"
        },
        {
          "t": "Registrar los pagos pendientes tildando pacientes (total o una parte)",
          "min": 45,
          "donde": "Gerencial → Producción y liquidación"
        },
        {
          "t": "Historial de pagos: ¿quién cargó qué y cuándo?",
          "min": 15,
          "donde": "Gerencial → Historial de pagos"
        },
        {
          "t": "Cuentas Galicia y Mercado Pago: saldos al día",
          "min": 20,
          "donde": "Gerencial → Cuentas"
        }
      ],
      "bloque2": [
        {
          "t": "Reunión con Ane: gastos cargados, reserva, pagos por transferencia",
          "min": 45,
          "donde": "Con Ane"
        },
        {
          "t": "Gastos recurrentes: ¿falta cargar alguno?",
          "min": 20,
          "donde": "Gastos recurrentes"
        },
        {
          "t": "Consultorio (reserva): movimientos de la semana",
          "min": 20,
          "donde": "Gerencial → Consultorio (reserva)"
        }
      ]
    },
    {
      "corto": "Mié",
      "largo": "Miércoles",
      "tema": "Obras sociales",
      "lema": "Autorizar, controlar y cobrar lo de las obras sociales.",
      "foco": [
        {
          "t": "Autorizaciones pendientes: reclamar las que no avanzan",
          "min": 30,
          "donde": "Autorizaciones"
        },
        {
          "t": "Control de Obras Sociales: lo facturado contra lo atendido",
          "min": 45,
          "donde": "Gerencial → Control de Obras Sociales"
        },
        {
          "t": "Fichas Entre Ríos (Swiss Medical, Osde, Sancor)",
          "min": 30,
          "donde": "Gerencial → Fichas Entre Ríos"
        },
        {
          "t": "Cruce con ASOR y Pagos ASOR",
          "min": 30,
          "donde": "Gerencial → Cruce con ASOR · Pagos ASOR"
        }
      ],
      "bloque2": [
        {
          "t": "Cuentas por cobrar y planes de financiación: escribir a quien tiene cuotas vencidas",
          "min": 45,
          "donde": "Cuentas por cobrar · Planes"
        },
        {
          "t": "Presupuestos pendientes: seguimiento a los que no respondieron",
          "min": 30,
          "donde": "Presupuestos"
        },
        {
          "t": "Fichas con plan de obra social o condición de IVA «sin cargar»: pedir el dato",
          "min": 20,
          "donde": "Pacientes"
        }
      ]
    },
    {
      "corto": "Jue",
      "largo": "Jueves",
      "tema": "Marca y equipo",
      "lema": "Que la clínica se vea y se comunique como quiere ser.",
      "foco": [
        {
          "t": "Calendario de contenido con Lourdes: aprobar los posteos de la semana que viene",
          "min": 45,
          "donde": "Calendario de Contenido"
        },
        {
          "t": "Biblioteca de marca: ¿se usa lo oficial (logo, colores, tipografías)?",
          "min": 20,
          "donde": "Biblioteca de marca"
        },
        {
          "t": "Cartel y QR de beneficios en recepción: ¿están a la vista?",
          "min": 10,
          "donde": "Recepción"
        },
        {
          "t": "Metas del mes: cómo vamos",
          "min": 20,
          "donde": "Metas y Seguimiento"
        }
      ],
      "bloque2": [
        {
          "t": "Uno a uno con profesionales (de a uno por semana): feedback, horarios, dudas",
          "min": 60,
          "donde": "Consultorio"
        },
        {
          "t": "Historias clínicas y consentimientos incompletos: pedir que se completen",
          "min": 30,
          "donde": "Pacientes → Mostrar solo incompletos · Consentimientos"
        },
        {
          "t": "Manuales de Secretaría y Odontólogos: ¿hay algo para actualizar?",
          "min": 15,
          "donde": "Documentos"
        }
      ]
    },
    {
      "corto": "Vie",
      "largo": "Viernes",
      "tema": "Cierre de la semana",
      "lema": "Cerrar números, insumos y pendientes para arrancar el lunes limpio.",
      "foco": [
        {
          "t": "Balance Mensual al día",
          "min": 30,
          "donde": "Gerencial → Balance Mensual"
        },
        {
          "t": "Lo que queda limpio: revisar la semana",
          "min": 30,
          "donde": "Gerencial → Lo que queda limpio"
        },
        {
          "t": "Stock de insumos y pedidos; trabajos de laboratorio con Yamila",
          "min": 45,
          "donde": "Stock de Insumos · Laboratorio"
        },
        {
          "t": "Gastos de la semana cargados",
          "min": 20,
          "donde": "Gastos de la Clínica"
        }
      ],
      "bloque2": [
        {
          "t": "Revisión de la semana: 3 cosas que salieron bien y 3 que no",
          "min": 30,
          "donde": "Papel o notas"
        },
        {
          "t": "Qué revisar en cero antes de irme",
          "min": 30,
          "donde": "Gerencial → Qué revisar"
        },
        {
          "t": "Planificar la semana que viene: elegir los 3 temas",
          "min": 30,
          "donde": "Papel o notas"
        },
        {
          "t": "Los pendientes que pasan al lunes: anotados con fecha",
          "min": 20,
          "donde": "Papel o notas"
        }
      ]
    }
  ],
  "mes": [
    {
      "cuando": "Días 1 a 3",
      "dia": 1,
      "titulo": "Cierre de mes",
      "items": [
        "Cerrar el mes y revisar el Balance Mensual",
        "Conciliar los bancos en Cuentas",
        "Sueldos con Ane"
      ],
      "donde": "Gerencial → Cierre de Mes · Balance Mensual · Cuentas"
    },
    {
      "cuando": "Día 5",
      "dia": 5,
      "titulo": "Obras sociales a mes vencido",
      "items": [
        "Facturación a obras sociales del mes anterior",
        "Liquidar honorarios de obra social a los profesionales"
      ],
      "donde": "Gerencial → Control de Obras Sociales · Producción y liquidación"
    },
    {
      "cuando": "Día 10",
      "dia": 10,
      "titulo": "Aumentos de ortodoncia",
      "items": [
        "Revisar las cuotas con aumento vencido",
        "Avisar a los secretarios cuáles cambian"
      ],
      "donde": "Gerencial → Aumentos de ortodoncia"
    },
    {
      "cuando": "Día 15",
      "dia": 15,
      "titulo": "Mitad de mes",
      "items": [
        "Metas: cómo vamos",
        "Limpieza de pacientes de ortodoncia"
      ],
      "donde": "Metas y Seguimiento · Ortodoncia → Limpieza"
    },
    {
      "cuando": "Día 20",
      "dia": 20,
      "titulo": "Reserva y gastos fijos",
      "items": [
        "Control de gastos recurrentes",
        "Movimientos de la reserva del Consultorio",
        "Pedido grande de insumos"
      ],
      "donde": "Gastos recurrentes · Consultorio (reserva) · Stock"
    },
    {
      "cuando": "Último día",
      "dia": -1,
      "titulo": "Antes de cerrar el mes",
      "items": [
        "Balance al día, sin pendientes de carga",
        "Planificar el mes que viene",
        "Cartel y tarjetas de beneficios: ¿reponer?"
      ],
      "donde": "Gerencial → Balance Mensual"
    }
  ],
  "reglas": [
    {
      "t": "Tres prioridades por día, no diez",
      "d": "Las escribís al llegar y las revisás en el punto medio. Si algo nuevo entra, algo sale."
    },
    {
      "t": "La plata se mira dos veces, no todo el día",
      "d": "Punto medio y cierre. Entre medio, la secretaría carga y vos no controlás cada cobro."
    },
    {
      "t": "Mensajes en tres ventanas",
      "d": "Al llegar, en el punto medio y en el cierre. Fuera de eso, solo lo urgente de verdad."
    },
    {
      "t": "Cada tema, su día",
      "d": "Liquidaciones el martes, obras sociales el miércoles. Si hoy no toca, anotalo en el día que toca y soltalo."
    },
    {
      "t": "Lo que se puede delegar, se delega con fecha",
      "d": "Simón y Lola cierran turnos y cargan datos; Ane, gastos y reserva; Lourdes, contenido. Vos revisás."
    },
    {
      "t": "Cerrar el día es parte del trabajo",
      "d": "Si el cierre se saltea, mañana arranca con deuda. Esa hora no se negocia."
    }
  ]
};
