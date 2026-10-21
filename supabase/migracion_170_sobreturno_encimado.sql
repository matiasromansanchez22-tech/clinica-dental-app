-- Migración 170: sobreturnos "encimados" en la agenda de Ortodoncia.
--
-- Un sobreturno se agenda ENCIMA de otro turno (mismo horario, mismo consultorio u ortodoncista) por si el otro se cancela y no se
-- pierde el lugar. Se muestra aparte en la agenda (columna "Sobreturnos") y no bloquea ni es bloqueado por los demás turnos.
-- Cuando el lugar se libera, se pasa a "turno normal" desde el detalle del turno.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table turnos_ortodoncia add column if not exists sobreturno boolean not null default false;
