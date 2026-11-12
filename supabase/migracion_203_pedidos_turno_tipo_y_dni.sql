-- Migración 203: los pedidos de turno de la página pública (/ortodoncia-info) ahora dicen qué tipo de turno es y el documento.
--
-- tipo: 'Consulta' (primera vez), 'Control' (ya está en tratamiento con nosotros) o 'Continuación' (empezó en otra clínica).
--       Los pedidos que ya existían quedan como 'Consulta'.
-- dni:  el número de documento que escribió la persona (solo números). Le sirve a Recepción para encontrar la ficha. Es opcional para
--       las consultas nuevas y se pide en controles y continuaciones.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table solicitudes_turno_ortodoncia add column if not exists tipo text not null default 'Consulta';
alter table solicitudes_turno_ortodoncia drop constraint if exists solicitudes_turno_tipo_check;
alter table solicitudes_turno_ortodoncia add constraint solicitudes_turno_tipo_check check (tipo in ('Consulta', 'Control', 'Continuación'));
alter table solicitudes_turno_ortodoncia add column if not exists dni text;
