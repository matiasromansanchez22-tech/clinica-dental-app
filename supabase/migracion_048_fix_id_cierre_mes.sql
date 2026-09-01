-- Migración 048: corrige cierres_mes_verificados — le faltaba su propia
-- columna "id" (necesaria para que el borrado pase por la Papelera de
-- reciclaje, igual que el resto de la app).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table cierres_mes_verificados add column if not exists id uuid default gen_random_uuid();
update cierres_mes_verificados set id = gen_random_uuid() where id is null;
alter table cierres_mes_verificados alter column id set not null;

alter table cierres_mes_verificados drop constraint if exists cierres_mes_verificados_pkey;
alter table cierres_mes_verificados add primary key (id);
alter table cierres_mes_verificados drop constraint if exists cierres_mes_verificados_anio_mes_key;
alter table cierres_mes_verificados add constraint cierres_mes_verificados_anio_mes_key unique (anio, mes);
