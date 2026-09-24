-- Migración 118: conectar "lo que vamos a hacer la próxima vez" con el
-- turno siguiente de ese paciente.
--
-- Al marcar qué se hizo hoy (Agenda), además de la nota de texto que ya
-- existía, se puede elegir una prestación/concepto para la próxima vez.
-- Cuando alguien crea el turno siguiente de ese paciente, se busca esto y
-- se pre-carga solo en "a qué viene" (o el concepto, en Ortodoncia).
-- "usada" evita que la misma sugerencia se siga pre-cargando en turnos
-- posteriores una vez que ya se usó en uno.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table prestaciones_realizadas_agenda
  add column if not exists proxima_prestacion_catalogo_id text,
  add column if not exists proxima_prestacion_nombre text,
  add column if not exists proxima_prestacion_tiempo_min integer,
  add column if not exists proxima_prestacion_usada boolean not null default false;
