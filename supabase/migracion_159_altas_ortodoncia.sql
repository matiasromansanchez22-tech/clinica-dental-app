-- Migración 159: pacientes de Ortodoncia dados de alta + aviso cada 6 meses para escribirles.
--
-- Cuando un paciente termina el tratamiento se lo marca de alta: queda "Finalizado" con la fecha
-- del alta. Cada 6 meses (desde el alta o desde el último mensaje) aparece en "Altas" para
-- escribirle y preguntarle cómo viene todo; al escribirle se anota la fecha y el aviso vuelve
-- a los 6 meses.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table pacientes_ortodoncia add column if not exists fecha_alta date;
alter table pacientes_ortodoncia add column if not exists ultimo_seguimiento_alta date;
alter table pacientes_ortodoncia add column if not exists nota_alta text;
