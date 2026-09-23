-- Migración 115: "va a pagar después" desde la nube.
--
-- Cuando el paciente no va a pagar hoy lo que se marcó en Agenda (ej. una
-- desinstalación que paga el lunes), se le pone una fecha prometida — sale
-- de la nube (ya no hay que cobrarlo HOY) y pasa a una sección nueva dentro
-- de "Cuentas por cobrar" (General u Ortodoncia, según corresponda),
-- ordenada por esa fecha.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table prestaciones_realizadas_agenda
  add column if not exists fecha_promesa_pago date;
