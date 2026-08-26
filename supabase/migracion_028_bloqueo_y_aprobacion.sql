-- Migración 028: bloqueo de cobros al cerrar el turno + aprobación final
-- del día por la Dueña.
--
-- 1) Los cobros de Caja General y Caja Ortodoncia ahora tienen un campo
--    "cerrado". Cuando un secretario/a guarda su Cierre de Turno, todos
--    sus cobros de ese día quedan bloqueados (no se pueden editar ni
--    borrar). Solo la Dueña puede "reabrir" un turno para corregir algo.
-- 2) Se agrega "cierres_dia_verificados": el cierre final que hace la
--    Dueña después de revisar todo, aprobando el día completo (General +
--    Ortodoncia, todos los turnos).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table caja_general add column if not exists cerrado boolean not null default false;
alter table caja_ortodoncia add column if not exists cerrado boolean not null default false;

drop policy if exists autenticados_todo on caja_general;
create policy caja_general_leer on caja_general for select using (es_staff());
create policy caja_general_crear on caja_general for insert with check (es_staff());
create policy caja_general_modificar on caja_general for update using (es_staff() and (cerrado = false or es_duena())) with check (es_staff());
create policy caja_general_borrar on caja_general for delete using (es_staff() and (cerrado = false or es_duena()));

drop policy if exists autenticados_todo on caja_ortodoncia;
create policy caja_ortodoncia_leer on caja_ortodoncia for select using (es_staff());
create policy caja_ortodoncia_crear on caja_ortodoncia for insert with check (es_staff());
create policy caja_ortodoncia_modificar on caja_ortodoncia for update using (es_staff() and (cerrado = false or es_duena())) with check (es_staff());
create policy caja_ortodoncia_borrar on caja_ortodoncia for delete using (es_staff() and (cerrado = false or es_duena()));

create table if not exists cierres_dia_verificados (
  fecha date primary key,
  usuario_id uuid references auth.users(id),
  nombre_duena text,
  aprobado_en timestamptz not null default now(),
  observaciones text
);

alter table cierres_dia_verificados enable row level security;
drop policy if exists cierre_dia_leer on cierres_dia_verificados;
create policy cierre_dia_leer on cierres_dia_verificados for select using (es_staff());
drop policy if exists cierre_dia_escribir on cierres_dia_verificados;
create policy cierre_dia_escribir on cierres_dia_verificados for all using (es_duena()) with check (es_duena());
