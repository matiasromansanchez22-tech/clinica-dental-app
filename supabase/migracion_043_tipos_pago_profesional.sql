-- Migración 043: agrega "Particular" y "Copago/Particular" como tipos
-- válidos de pago a profesional, para reflejar cómo se paga en el día a
-- día desde Caja (no siempre es una mezcla de copago + particular, a
-- veces es uno solo). "Obra Social" se mantiene porque Producción y
-- liquidación lo sigue usando para el pago de la parte de obra social.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table pagos_profesionales drop constraint if exists pagos_profesionales_tipo_check;
alter table pagos_profesionales add constraint pagos_profesionales_tipo_check
  check (tipo in ('Copago', 'Obra Social', 'Particular', 'Copago/Particular'));
