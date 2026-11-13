-- Migración 204: registro de ingreso de los profesionales (puntualidad).
--
-- Recepción (Simón y las demás secretarias) marca a qué hora llega cada profesional, a la mañana y a la tarde. Cada marca guarda:
--   - el turno (Mañana o Tarde) y la hora a la que empezaba su horario ese día (según la disponibilidad de la Agenda),
--   - la hora real de llegada (o "No vino"),
--   - el margen que se les pide (hoy 15 minutos antes), para que el historial no cambie si la regla cambia,
--   - quién hizo la marca y si la hora se cargó a mano en vez de tomarse en el momento.
-- Las Dueñas ven el informe de cumplimiento. Cada marca se puede deshacer por quien la hizo hasta 15 minutos después; pasado ese
-- tiempo solo las Dueñas pueden corregirla.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists ingresos_profesionales (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  profesional_id uuid not null references profesionales(id),
  turno text not null check (turno in ('Mañana', 'Tarde')),
  hora_programada time not null,
  estado text not null default 'Llegó' check (estado in ('Llegó', 'No vino')),
  hora_llegada time,
  margen_min integer not null default 15,
  manual boolean not null default false,
  nota text,
  marcado_por uuid references perfiles(id),
  created_at timestamptz not null default now(),
  unique (fecha, profesional_id, turno),
  check ((estado = 'Llegó' and hora_llegada is not null) or (estado = 'No vino' and hora_llegada is null))
);

create index if not exists ingresos_profesionales_fecha_idx on ingresos_profesionales (fecha desc);

alter table ingresos_profesionales enable row level security;

drop policy if exists ingresos_prof_ver on ingresos_profesionales;
create policy ingresos_prof_ver on ingresos_profesionales for select using (es_caja());

drop policy if exists ingresos_prof_crear on ingresos_profesionales;
create policy ingresos_prof_crear on ingresos_profesionales for insert with check (es_caja() and marcado_por = auth.uid());

drop policy if exists ingresos_prof_corregir on ingresos_profesionales;
create policy ingresos_prof_corregir on ingresos_profesionales for update
  using (es_duena() or (marcado_por = auth.uid() and created_at > now() - interval '15 minutes'))
  with check (es_duena() or (marcado_por = auth.uid() and created_at > now() - interval '15 minutes'));

drop policy if exists ingresos_prof_borrar on ingresos_profesionales;
create policy ingresos_prof_borrar on ingresos_profesionales for delete
  using (es_duena() or (marcado_por = auth.uid() and created_at > now() - interval '15 minutes'));
