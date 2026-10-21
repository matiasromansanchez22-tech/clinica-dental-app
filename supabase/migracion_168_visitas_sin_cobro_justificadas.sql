-- Migración 168: control de "visitas sin cobro" al cerrar el turno de Ortodoncia.
--
-- Al cerrar el turno, la secretaria ve los pacientes que vinieron ese día y no tienen ningún cobro cargado. Para cerrar tiene que
-- resolver cada uno: cargar el cobro, o justificar por qué no hay cobro ("Pagó antes", "No se cobra esta visita" o "Queda pendiente
-- de pago"). Esta tabla guarda esas justificaciones (una por turno), con quién la hizo y cuándo.
--
-- La cargan y ven las Dueñas y las Secretarias; la Contadora solo puede ver.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists visitas_sin_cobro_justificadas (
  id uuid primary key default gen_random_uuid(),
  turno_ortodoncia_id uuid not null unique references turnos_ortodoncia(id) on delete cascade,
  paciente_id uuid,
  fecha date not null,
  motivo text not null check (motivo in ('Pagó antes', 'No se cobra esta visita', 'Queda pendiente de pago')),
  nota text,
  usuario_id uuid references perfiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists visitas_sin_cobro_justificadas_fecha_idx on visitas_sin_cobro_justificadas (fecha);

alter table visitas_sin_cobro_justificadas enable row level security;
drop policy if exists visitas_sin_cobro_caja on visitas_sin_cobro_justificadas;
create policy visitas_sin_cobro_caja on visitas_sin_cobro_justificadas for all using (es_caja()) with check (es_caja());
drop policy if exists visitas_sin_cobro_contador_ver on visitas_sin_cobro_justificadas;
create policy visitas_sin_cobro_contador_ver on visitas_sin_cobro_justificadas for select using (es_contador());
