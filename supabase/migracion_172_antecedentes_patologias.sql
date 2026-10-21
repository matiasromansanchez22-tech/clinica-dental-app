-- Migración 172: antecedentes médicos y patologías de los pacientes de Odontología General.
--
-- Mismo esquema que el encabezado de la historia clínica en papel (enfermedades, patologías, alergias, medicación, ATM) más una lista de
-- condiciones frecuentes para tildar (diabetes, hipertensión, anticoagulantes, embarazo...). Con eso la agenda le muestra al profesional
-- un cartel de "Alertas médicas" antes de atender.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table pacientes
  add column if not exists ant_enfermedades text,
  add column if not exists ant_patologias text,
  add column if not exists ant_alergias text,
  add column if not exists ant_medicacion text,
  add column if not exists ant_atm text,
  add column if not exists ant_condiciones text[] not null default '{}',
  add column if not exists ant_actualizado_en timestamptz;
