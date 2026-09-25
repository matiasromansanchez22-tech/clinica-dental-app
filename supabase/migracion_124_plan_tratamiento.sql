-- Migración 124: plan de tratamiento (Sistema General).
--
-- Un solo texto por paciente donde el profesional carga el paso a paso
-- del tratamiento que armó (ej: "1) Extracción 36. 2) Implante a los 3
-- meses. 3) Corona definitiva.") — se edita y reemplaza, no queda
-- historial de versiones anteriores. Separado a propósito del "Historial
-- clínico" (que sí es un registro fechado, visita a visita) y de
-- "Observaciones clínicas".
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table pacientes add column if not exists plan_tratamiento text;
