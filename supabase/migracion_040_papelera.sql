-- Migración 040: Papelera de reciclaje general. Cuando se borra algo desde
-- la app, en vez de desaparecer para siempre se guarda una copia acá por un
-- tiempo (se puede restaurar), y recién después de un tiempo se limpia.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists papelera (
  id uuid primary key default gen_random_uuid(),
  tabla text not null,
  registro_id uuid not null,
  datos jsonb not null,
  borrado_en timestamptz not null default now(),
  borrado_por uuid references auth.users(id)
);
create index if not exists papelera_tabla_idx on papelera (tabla);
create index if not exists papelera_borrado_en_idx on papelera (borrado_en);

alter table papelera enable row level security;

-- Cualquier miembro del staff puede "tirar algo a la papelera" (es lo mismo
-- que ya podía borrar antes). Ver, restaurar y vaciar la papelera es solo
-- de la Dueña.
drop policy if exists papelera_insertar on papelera;
create policy papelera_insertar on papelera for insert with check (es_staff());
drop policy if exists papelera_leer on papelera;
create policy papelera_leer on papelera for select using (es_duena());
drop policy if exists papelera_borrar on papelera;
create policy papelera_borrar on papelera for delete using (es_duena());
