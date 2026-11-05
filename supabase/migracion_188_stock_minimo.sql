-- Migración 188: stock mínimo por insumo y aviso de poco stock.
--
-- stock_minimo: cuando lo que queda en el Stock (depósito) baja de ese número, la app avisa a las dueñas.
--               Si queda vacío, ese insumo no avisa.
-- aviso_stock_bajo: marca interna para avisar una sola vez (se apaga sola cuando se repone).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table stock_insumos add column if not exists stock_minimo numeric check (stock_minimo is null or stock_minimo >= 0);
alter table stock_insumos add column if not exists aviso_stock_bajo boolean not null default false;
