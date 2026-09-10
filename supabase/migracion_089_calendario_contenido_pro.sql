-- Migración 089: le suma al Calendario de Contenido de la Community
-- Manager un banco de fechas especiales (para disparar ideas de
-- contenido) y una biblioteca de marca (logo, plantillas y archivos de
-- referencia), aparte del aviso automático que se agrega en el código
-- cuando algo pasa a "Aprobado" (eso no necesita cambios en la base).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

-- Fechas especiales (se repiten cada año): la Dueña las administra, la
-- CM las usa como disparador de ideas de contenido.
create table if not exists fechas_especiales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  mes integer not null check (mes between 1 and 12),
  dia integer not null check (dia between 1 and 31),
  observaciones text,
  created_at timestamptz not null default now()
);

alter table fechas_especiales enable row level security;
drop policy if exists fechas_especiales_leer on fechas_especiales;
create policy fechas_especiales_leer on fechas_especiales for select using (es_duena() or es_cm());
drop policy if exists fechas_especiales_escribir on fechas_especiales;
create policy fechas_especiales_escribir on fechas_especiales for all using (es_duena()) with check (es_duena());

-- Un par de fechas de arranque, seguras y conocidas — el resto (Día del
-- Odontólogo, aniversario de la clínica, promociones) se agregan desde
-- la app, para no dar por sentada una fecha que no está confirmada.
do $$
begin
  if not exists (select 1 from fechas_especiales) then
    insert into fechas_especiales (nombre, mes, dia) values
      ('Día Mundial de la Salud Bucodental', 3, 20),
      ('Año Nuevo', 1, 1),
      ('Navidad', 12, 25);
  end if;
end $$;

-- Biblioteca de marca: logo, plantillas y demás archivos de referencia
-- para armar contenido, en un solo lugar. Solo la Dueña sube/borra, la
-- CM puede ver y descargar.
insert into storage.buckets (id, name, public)
values ('biblioteca-marca', 'biblioteca-marca', false)
on conflict (id) do nothing;

drop policy if exists biblioteca_marca_storage_leer on storage.objects;
create policy biblioteca_marca_storage_leer on storage.objects for select
  using (bucket_id = 'biblioteca-marca' and (es_duena() or es_cm()));

drop policy if exists biblioteca_marca_storage_subir on storage.objects;
create policy biblioteca_marca_storage_subir on storage.objects for insert
  with check (bucket_id = 'biblioteca-marca' and es_duena());

drop policy if exists biblioteca_marca_storage_borrar on storage.objects;
create policy biblioteca_marca_storage_borrar on storage.objects for delete
  using (bucket_id = 'biblioteca-marca' and es_duena());

create table if not exists biblioteca_marca (
  id uuid primary key default gen_random_uuid(),
  nombre_archivo text not null,
  storage_path text not null,
  categoria text not null default 'Otros' check (categoria in ('Logos', 'Plantillas', 'Otros')),
  subido_por uuid references perfiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table biblioteca_marca enable row level security;
drop policy if exists biblioteca_marca_leer on biblioteca_marca;
create policy biblioteca_marca_leer on biblioteca_marca for select using (es_duena() or es_cm());
drop policy if exists biblioteca_marca_escribir on biblioteca_marca;
create policy biblioteca_marca_escribir on biblioteca_marca for all using (es_duena()) with check (es_duena());
