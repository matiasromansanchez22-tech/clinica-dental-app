-- Migración 064: Registro de accesos — para que la Dueña pueda ver quién
-- entró al sistema y cuándo (login real, no cada vez que se refresca una
-- pestaña). Solo lectura para la Dueña; cada usuario solo puede anotar su
-- propio ingreso.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists accesos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id),
  logueado_en timestamptz not null default now()
);
create index if not exists accesos_logueado_en_idx on accesos (logueado_en desc);

alter table accesos enable row level security;

drop policy if exists accesos_insertar on accesos;
create policy accesos_insertar on accesos for insert with check (usuario_id = auth.uid());

drop policy if exists accesos_leer on accesos;
create policy accesos_leer on accesos for select using (es_duena());
