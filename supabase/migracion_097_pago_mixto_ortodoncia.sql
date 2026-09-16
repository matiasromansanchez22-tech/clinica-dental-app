-- Migración 097: permite cargar un cobro de Ortodoncia pagado con más de
-- un medio de pago a la vez (ej. una parte en efectivo y otra por
-- transferencia) — lo mismo que ya se puede hacer en Caja General
-- (migración 083).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table caja_ortodoncia
  add column if not exists desglose_pago jsonb;

alter table caja_ortodoncia drop constraint if exists caja_ortodoncia_medio_pago_check;
alter table caja_ortodoncia
  add constraint caja_ortodoncia_medio_pago_check
  check (medio_pago in ('Efectivo', 'Transferencia', 'Débito', 'Crédito', 'Mercado Pago', 'QR', 'Mixto'));

alter table caja_ortodoncia drop constraint if exists caja_ortodoncia_destino_check;
alter table caja_ortodoncia
  add constraint caja_ortodoncia_destino_check
  check (destino in ('Caja', 'Banco', 'Mixto'));
