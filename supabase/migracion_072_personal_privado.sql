-- Migración 072: hace privado el panel Personal entre Matías y
-- Marianela — cada uno ve solo lo suyo, aunque los dos sean "Dueña" en
-- el sistema. El panel Consultorio sigue siendo compartido entre los
-- dos (es la reserva del consultorio, no de cada uno).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table movimientos_personales
  add column if not exists usuario_id uuid references perfiles(id);

alter table movimientos_personales enable row level security;

drop policy if exists duena_todo on movimientos_personales;

drop policy if exists consultorio_duena on movimientos_personales;
create policy consultorio_duena on movimientos_personales for all
  using (panel = 'Consultorio' and es_duena())
  with check (panel = 'Consultorio' and es_duena());

drop policy if exists personal_propio on movimientos_personales;
create policy personal_propio on movimientos_personales for all
  using (panel = 'Personal' and es_duena() and usuario_id = auth.uid())
  with check (panel = 'Personal' and es_duena() and usuario_id = auth.uid());
