-- Migración 011: Pacientes de Ortodoncia + parámetros propios de Ortodoncia.
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists pacientes_ortodoncia (
  id uuid primary key default gen_random_uuid(),
  codigo_legado text,
  nombre text not null,
  whatsapp text,
  fecha_nacimiento date,
  fecha_instalacion date,
  historial_clinico text,
  fotografias text,
  rx_inicial text,
  rx_6_meses text,
  rx_12_meses text,
  consentimiento text,
  tipo_brackets text,
  cuota_inicial numeric,
  forma_pago_instalacion text,
  instalacion_cuota_1 text,
  instalacion_cuota_2 text,
  estado_instalacion text,
  valor_control numeric,
  ortodoncista_id uuid references profesionales(id),
  estado_paciente text not null default 'Activo' check (estado_paciente in ('Activo', 'Inactivo', 'Finalizado', 'Abandonó')),
  ultimo_control date,
  proximo_turno date,
  observaciones_clinicas text,
  ultimo_aumento date,
  proximo_aumento date,
  referido_por text,
  email text,
  fecha_baja date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pacientes_ortodoncia_nombre_idx on pacientes_ortodoncia (nombre);

alter table pacientes_ortodoncia enable row level security;
create policy autenticados_todo on pacientes_ortodoncia for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table if not exists configuracion_ortodoncia (
  clave text primary key,
  valor numeric not null
);

insert into configuracion_ortodoncia (clave, valor) values
  ('aumento_porcentaje', 25),
  ('meses_entre_aumentos', 6),
  ('dias_recordatorio_rx_6_meses', 180),
  ('dias_recordatorio_rx_12_meses', 365)
on conflict (clave) do nothing;

alter table configuracion_ortodoncia enable row level security;
create policy config_leer on configuracion_ortodoncia for select using (auth.uid() is not null);
create policy config_escribir on configuracion_ortodoncia for all using (es_duena()) with check (es_duena());
