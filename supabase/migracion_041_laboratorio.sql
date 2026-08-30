-- Migración 041: Laboratorio / Prótesis — seguimiento de trabajos que van
-- al mecánico (prótesis, coronas, etc.), con historial de idas y vueltas
-- para medir demoras. Agrega también el rol "Laboratorio" para el usuario
-- que va a llevar esto (ej. Yamila), sin acceso a Gerencial.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table perfiles drop constraint if exists perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('Secretaria', 'Odontologo', 'Duena', 'Laboratorio'));

create table if not exists laboratorio_trabajos (
  id uuid primary key default gen_random_uuid(),
  tipo_paciente text not null check (tipo_paciente in ('General', 'Ortodoncia')),
  paciente_id uuid not null,
  paciente_nombre text not null,
  profesional_id uuid references profesionales(id),
  tipo_trabajo text not null,
  pieza text,
  laboratorio text,
  estado text not null default 'Enviado al mecánico' check (
    estado in ('Enviado al mecánico', 'Recibido del mecánico', 'Prueba con el paciente', 'Ajuste pendiente', 'Entregado')
  ),
  fecha_inicio date not null default current_date,
  fecha_ultimo_evento date not null default current_date,
  fecha_alta date,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists laboratorio_trabajos_estado_idx on laboratorio_trabajos (estado);

create table if not exists laboratorio_eventos (
  id uuid primary key default gen_random_uuid(),
  trabajo_id uuid not null references laboratorio_trabajos(id) on delete cascade,
  fecha date not null default current_date,
  tipo_evento text not null check (
    tipo_evento in ('Enviado al mecánico', 'Recibido del mecánico', 'Prueba con el paciente', 'Ajuste - reenviado', 'Alta / Entregado')
  ),
  observaciones text,
  created_at timestamptz not null default now()
);
create index if not exists laboratorio_eventos_trabajo_idx on laboratorio_eventos (trabajo_id, fecha desc);

create table if not exists configuracion_laboratorio (
  clave text primary key,
  valor numeric not null
);
insert into configuracion_laboratorio (clave, valor) values
  ('dias_alerta_demora', 5),
  ('dias_urgente_demora', 10)
on conflict (clave) do nothing;

alter table laboratorio_trabajos enable row level security;
drop policy if exists laboratorio_trabajos_todo on laboratorio_trabajos;
create policy laboratorio_trabajos_todo on laboratorio_trabajos for all using (es_staff()) with check (es_staff());

alter table laboratorio_eventos enable row level security;
drop policy if exists laboratorio_eventos_todo on laboratorio_eventos;
create policy laboratorio_eventos_todo on laboratorio_eventos for all using (es_staff()) with check (es_staff());

alter table configuracion_laboratorio enable row level security;
drop policy if exists config_laboratorio_leer on configuracion_laboratorio;
create policy config_laboratorio_leer on configuracion_laboratorio for select using (es_staff());
drop policy if exists config_laboratorio_escribir on configuracion_laboratorio;
create policy config_laboratorio_escribir on configuracion_laboratorio for all using (es_duena()) with check (es_duena());
