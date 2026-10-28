-- Migración 179: motivo por el que alguien que vino no pagó — ahora también para Odontología General.
--
-- Hasta ahora (migración 168) solo se podía justificar una visita sin cobro de Ortodoncia. Con esto también se puede
-- registrar para un turno de Odontología General, con motivos nuevos:
--   · Pagó antes · No se cobra esta visita · Queda pendiente de pago (los de siempre)
--   · Obra social (se factura) · Otro motivo (pide una nota)
--
-- Para DESHACER: alter table visitas_sin_cobro_justificadas drop column turno_general_id; (y volver a poner
-- turno_ortodoncia_id como not null).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table visitas_sin_cobro_justificadas add column if not exists turno_general_id uuid unique references turnos_general(id) on delete cascade;
alter table visitas_sin_cobro_justificadas alter column turno_ortodoncia_id drop not null;

alter table visitas_sin_cobro_justificadas drop constraint if exists visitas_sin_cobro_un_turno;
alter table visitas_sin_cobro_justificadas add constraint visitas_sin_cobro_un_turno check (num_nonnulls(turno_ortodoncia_id, turno_general_id) = 1);

alter table visitas_sin_cobro_justificadas drop constraint if exists visitas_sin_cobro_justificadas_motivo_check;
alter table visitas_sin_cobro_justificadas add constraint visitas_sin_cobro_justificadas_motivo_check
  check (motivo in ('Pagó antes', 'No se cobra esta visita', 'Queda pendiente de pago', 'Obra social (se factura)', 'Otro motivo'));
