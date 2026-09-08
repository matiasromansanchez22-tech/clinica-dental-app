-- Migración 078: para poder llevar la cuenta corriente de cada mecánico
-- (cuánto le debemos, cuánto ya le pagamos, cuánto nos queda a favor si se
-- le pagó de más), los gastos con categoría "Pagos a Laboratorio" ahora
-- pueden indicar a QUÉ mecánico corresponde ese pago.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table gastos
  add column if not exists mecanico text;
