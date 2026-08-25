-- Migración 004: campos completos de Alta de Pacientes.
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table pacientes drop constraint if exists pacientes_tipo_paciente_check;
alter table pacientes add constraint pacientes_tipo_paciente_check
  check (tipo_paciente in ('Particular', 'Obra Social', 'Mixto'));

alter table pacientes
  add column if not exists email text,
  add column if not exists direccion text,
  add column if not exists localidad text,
  add column if not exists como_nos_conocio text,
  add column if not exists paciente_referido_por text,
  add column if not exists estado_administrativo text,
  add column if not exists estado_clinico text,
  add column if not exists historia_clinica_completa boolean not null default false,
  add column if not exists consentimientos_firmados boolean not null default false;
