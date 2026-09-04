-- Migración 068: registro automático de errores de la app — para
-- enterarnos si algo se rompe sin depender de que alguien lo cuente. Solo
-- la Dueña los ve.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists errores_app (
  id uuid primary key default gen_random_uuid(),
  mensaje text,
  stack text,
  url text,
  contexto text,
  usuario_id uuid references perfiles(id),
  created_at timestamptz not null default now()
);
create index if not exists errores_app_created_at_idx on errores_app (created_at desc);

alter table errores_app enable row level security;

drop policy if exists cualquiera_inserta on errores_app;
create policy cualquiera_inserta on errores_app for insert with check (auth.uid() is not null);

drop policy if exists duena_lee on errores_app;
create policy duena_lee on errores_app for select using (es_duena());

drop policy if exists duena_borra on errores_app;
create policy duena_borra on errores_app for delete using (es_duena());
