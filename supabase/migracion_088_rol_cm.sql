-- Migración 088: Rol "CM" (Community Manager) — acceso acotado a Pano y
-- fotos (fotos de pacientes) y a un Calendario de Contenido nuevo para
-- planificar los posteos en redes, sin acceso a nada de historia clínica,
-- agenda ni datos financieros.
--
-- Además: un tilde de "autoriza fotos en redes" por paciente, para que la
-- CM solo use las fotos de los pacientes que dieron ese permiso.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table perfiles drop constraint if exists perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('Secretaria', 'Odontologo', 'Duena', 'Laboratorio', 'Contador', 'CM'));

-- es_staff() ahora también excluye a CM (igual que ya excluye a Contador),
-- así que todo lo protegido con es_staff() queda bloqueado para la CM sin
-- tener que tocar esas políticas una por una.
create or replace function es_staff()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol not in ('Contador', 'CM')
  );
$$;

create or replace function es_cm()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol = 'CM'
  );
$$;

-- Tilde de autorización de uso de fotos en redes, por paciente.
alter table pacientes add column if not exists autoriza_fotos_redes boolean not null default false;
alter table pacientes_ortodoncia add column if not exists autoriza_fotos_redes boolean not null default false;

-- La CM puede LEER nombre de pacientes (para elegir carpeta en Pano y
-- fotos) y las panorámicas en sí — nunca cargar historia clínica, turnos
-- ni nada financiero.
drop policy if exists cm_leer on pacientes;
create policy cm_leer on pacientes for select using (es_cm());
drop policy if exists cm_leer on pacientes_ortodoncia;
create policy cm_leer on pacientes_ortodoncia for select using (es_cm());
drop policy if exists cm_leer on panoramicas;
create policy cm_leer on panoramicas for select using (es_cm());

drop policy if exists panoramicas_storage_leer_cm on storage.objects;
create policy panoramicas_storage_leer_cm on storage.objects for select
  using (bucket_id = 'panoramicas-pacientes' and es_cm());

-- Importante: sin esto la CM ni siquiera podría leer su propia fila para
-- iniciar sesión (mismo motivo que ya se resolvió para el Contador).
drop policy if exists propio_perfil_leer on perfiles;
create policy propio_perfil_leer on perfiles for select using (id = auth.uid());

-- Calendario de Contenido: posteos planificados para redes sociales, con
-- su estado y opcionalmente a qué paciente corresponden las fotos.
create table if not exists calendario_contenido (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  red_social text not null default 'Instagram',
  estado text not null default 'Idea' check (estado in ('Idea', 'Diseño', 'Aprobado', 'Publicado')),
  texto text,
  tipo_paciente text check (tipo_paciente in ('General', 'Ortodoncia')),
  paciente_id uuid,
  paciente_nombre text,
  observaciones text,
  creado_por uuid references perfiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calendario_contenido_fecha_idx on calendario_contenido (fecha);

alter table calendario_contenido enable row level security;
drop policy if exists calendario_contenido_duena_cm on calendario_contenido;
create policy calendario_contenido_duena_cm on calendario_contenido for all
  using (es_duena() or es_cm()) with check (es_duena() or es_cm());
