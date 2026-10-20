-- Migración 160: turnos de "Prioridad" en Ortodoncia.
--
-- Cuando un paciente de una ortodoncista (ej. Virginia) tiene que atenderse con otra (ej. Marianela)
-- porque la suya no tiene disponibilidad, el turno se marca como prioridad. Se guarda quién es la
-- ortodoncista habitual del paciente para saber que después vuelve con ella. La ficha del paciente
-- no se toca.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table turnos_ortodoncia add column if not exists prioridad boolean not null default false;
alter table turnos_ortodoncia add column if not exists ortodoncista_habitual_id uuid references profesionales(id);
alter table turnos_ortodoncia add column if not exists motivo_prioridad text;

create index if not exists turnos_ortodoncia_prioridad_idx on turnos_ortodoncia (fecha) where prioridad = true;
