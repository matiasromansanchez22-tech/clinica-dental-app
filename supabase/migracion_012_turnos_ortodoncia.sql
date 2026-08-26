-- Migración 012: Agenda de Ortodoncia.
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists turnos_ortodoncia (
  id uuid primary key default gen_random_uuid(),
  codigo_legado text,
  fecha date not null,
  hora_inicio time not null,
  duracion_min integer not null default 15,
  consultorio integer not null check (consultorio in (2, 3)),
  paciente_id uuid references pacientes_ortodoncia(id),
  whatsapp text,
  ortodoncista_id uuid references profesionales(id),
  concepto text not null check (
    concepto in (
      'Consulta de ortodoncia', 'Control', 'Instalación superior', 'Instalación inferior',
      'Reposición', 'Retiro', 'Urgencia'
    )
  ),
  valor numeric,
  estado text not null default 'Agendado' check (estado in ('Pendiente', 'Agendado', 'Reprogramado', 'Cancelado')),
  confirmacion text not null default 'Sin confirmar' check (
    confirmacion in ('Sin confirmar', 'Confirmado', 'No responde', 'Reprogramar')
  ),
  presencia text not null default 'Pendiente' check (
    presencia in ('Pendiente', 'En espera', 'En consultorio', 'Finalizado')
  ),
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists turnos_ortodoncia_fecha_idx on turnos_ortodoncia (fecha, consultorio);

alter table turnos_ortodoncia enable row level security;
create policy autenticados_todo on turnos_ortodoncia for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Duración por defecto de cada concepto, editable (no fija en el código).
create table if not exists configuracion_duracion_ortodoncia (
  concepto text primary key,
  duracion_min integer not null
);

insert into configuracion_duracion_ortodoncia (concepto, duracion_min) values
  ('Consulta de ortodoncia', 15),
  ('Control', 15),
  ('Instalación superior', 45),
  ('Instalación inferior', 45),
  ('Reposición', 15),
  ('Retiro', 30),
  ('Urgencia', 15)
on conflict (concepto) do nothing;

alter table configuracion_duracion_ortodoncia enable row level security;
create policy config_leer on configuracion_duracion_ortodoncia for select using (auth.uid() is not null);
create policy config_escribir on configuracion_duracion_ortodoncia for all using (es_duena()) with check (es_duena());
