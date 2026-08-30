-- Migración 042: Panel de Estadísticas (solo Dueña).
--
-- Agrega dos columnas para saber EXACTAMENTE cuándo se marcó completa la
-- historia clínica y el consentimiento de un paciente de Odontología General
-- (hasta ahora solo se sabía "sí/no", no la fecha), y un umbral configurable
-- para el indicador de "plata acumulada suficiente para invertir".
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table pacientes add column if not exists historia_clinica_marcada_en timestamptz;
alter table pacientes add column if not exists consentimiento_marcado_en timestamptz;

insert into configuracion_general (clave, valor) values
  ('monto_umbral_invertir', 0)
on conflict (clave) do nothing;
