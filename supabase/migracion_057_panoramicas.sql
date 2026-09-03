-- Migración 057: Panorámicas de pacientes — carpeta compartida (por
-- paciente, armada sola) donde subir las radiografías panorámicas que
-- mandan por mail, visible para todo el personal.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

-- Bucket de almacenamiento privado (no público: solo se puede ver con
-- una URL firmada que genera la app, y solo para personal logueado).
insert into storage.buckets (id, name, public)
values ('panoramicas-pacientes', 'panoramicas-pacientes', false)
on conflict (id) do nothing;

drop policy if exists panoramicas_storage_leer on storage.objects;
create policy panoramicas_storage_leer on storage.objects for select
  using (bucket_id = 'panoramicas-pacientes' and es_staff());

drop policy if exists panoramicas_storage_subir on storage.objects;
create policy panoramicas_storage_subir on storage.objects for insert
  with check (bucket_id = 'panoramicas-pacientes' and es_staff());

drop policy if exists panoramicas_storage_borrar on storage.objects;
create policy panoramicas_storage_borrar on storage.objects for delete
  using (bucket_id = 'panoramicas-pacientes' and es_staff());

-- Registro de cada panorámica subida (además del archivo en sí).
create table if not exists panoramicas (
  id uuid primary key default gen_random_uuid(),
  tipo_paciente text not null check (tipo_paciente in ('General', 'Ortodoncia')),
  paciente_id uuid not null,
  paciente_nombre text not null,
  storage_path text not null,
  nombre_archivo text not null,
  fecha date not null default current_date,
  observaciones text,
  subido_por uuid references perfiles(id),
  created_at timestamptz not null default now()
);
create index if not exists panoramicas_paciente_idx on panoramicas (tipo_paciente, paciente_id, fecha desc);

alter table panoramicas enable row level security;
drop policy if exists panoramicas_todo on panoramicas;
create policy panoramicas_todo on panoramicas for all using (es_staff()) with check (es_staff());
