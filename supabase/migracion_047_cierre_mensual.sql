-- Migración 047: Cierre de Mes.
--
-- Hasta ahora solo se podían bloquear los cobros del día (Caja). Los
-- gastos y los pagos a profesionales quedaban siempre editables, así que
-- el balance de un mes "cerrado" podía seguir cambiando en silencio.
--
-- 1) Gastos y Pagos a Profesionales ahora también tienen "cerrado", con
--    el mismo bloqueo que ya usa Caja (solo la Dueña puede tocar algo
--    cerrado).
-- 2) "cierres_mes_verificados": el cierre final del mes, con una foto fija
--    del balance. Al cerrar el mes se bloquean automáticamente todos los
--    gastos y pagos a profesionales de ese mes.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table gastos add column if not exists cerrado boolean not null default false;
alter table pagos_profesionales add column if not exists cerrado boolean not null default false;

drop policy if exists autenticados_todo on gastos;
drop policy if exists gastos_leer on gastos;
create policy gastos_leer on gastos for select using (es_staff());
drop policy if exists gastos_crear on gastos;
create policy gastos_crear on gastos for insert with check (es_staff());
drop policy if exists gastos_modificar on gastos;
create policy gastos_modificar on gastos for update using (es_staff() and (cerrado = false or es_duena())) with check (es_staff());
drop policy if exists gastos_borrar on gastos;
create policy gastos_borrar on gastos for delete using (es_staff() and (cerrado = false or es_duena()));

drop policy if exists autenticados_todo on pagos_profesionales;
drop policy if exists pagos_profesionales_leer on pagos_profesionales;
create policy pagos_profesionales_leer on pagos_profesionales for select using (es_staff());
drop policy if exists pagos_profesionales_crear on pagos_profesionales;
create policy pagos_profesionales_crear on pagos_profesionales for insert with check (es_staff());
drop policy if exists pagos_profesionales_modificar on pagos_profesionales;
create policy pagos_profesionales_modificar on pagos_profesionales for update using (es_staff() and (cerrado = false or es_duena())) with check (es_staff());
drop policy if exists pagos_profesionales_borrar on pagos_profesionales;
create policy pagos_profesionales_borrar on pagos_profesionales for delete using (es_staff() and (cerrado = false or es_duena()));

create table if not exists cierres_mes_verificados (
  id uuid primary key default gen_random_uuid(),
  anio integer not null,
  mes integer not null,
  usuario_id uuid references auth.users(id),
  nombre_duena text,
  aprobado_en timestamptz not null default now(),
  observaciones text,
  detalle jsonb,
  unique (anio, mes)
);

alter table cierres_mes_verificados enable row level security;
drop policy if exists cierre_mes_leer on cierres_mes_verificados;
create policy cierre_mes_leer on cierres_mes_verificados for select using (es_staff());
drop policy if exists cierre_mes_escribir on cierres_mes_verificados;
create policy cierre_mes_escribir on cierres_mes_verificados for all using (es_duena()) with check (es_duena());
