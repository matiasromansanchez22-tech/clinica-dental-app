-- Migración 151: "Alta" del paciente al marcar qué se hizo hoy.
--
-- En el paso "¿Qué vas a realizar la próxima vez?" el profesional puede indicar que el
-- paciente está dado de alta y no se va a realizar nada más. Entonces no hace falta elegir
-- la prestación del próximo turno, y si más adelante alguien le quiere dar un turno nuevo,
-- se le avisa que figura de alta (no lo bloquea).
--
-- Se guarda en la misma fila de la visita (prestaciones_realizadas_agenda). Vale el alta
-- de la visita más reciente: si el paciente vuelve y se marca otra visita sin alta, deja de
-- figurar de alta.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table prestaciones_realizadas_agenda
  add column if not exists alta boolean not null default false;
