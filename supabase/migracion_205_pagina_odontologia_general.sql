-- Migración 205: página pública de Odontología General (pedir turno según el motivo de la consulta).
--
-- 1) disponibilidad_fechas: "días puntuales" de un profesional (una fecha concreta con su horario), para quienes no vienen todas las
--    semanas el mismo día (ej. Yazmin: un miércoles de la mañana y uno de la tarde por mes). Se suman a su horario semanal.
-- 2) motivos_turno_general: los motivos de consulta que elige el paciente en la página, cuánto dura cada turno y qué profesionales
--    atienden ese motivo. Se pueden editar desde Consultas online → Motivos. "accion" dice qué pasa al elegirlo: pedir turno,
--    escribir por WhatsApp (urgencias) o pasar a la página de ortodoncia.
-- 3) solicitudes_turno_ortodoncia: los pedidos de General usan la misma tabla y el mismo panel que los de ortodoncia; se agrega
--    de qué área es cada uno, el motivo y la obra social.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

-- ---------- 1) Días puntuales ----------
create table if not exists disponibilidad_fechas (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references profesionales(id),
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  consultorio integer,
  nota text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  check (hora_fin > hora_inicio)
);
create index if not exists disponibilidad_fechas_fecha_idx on disponibilidad_fechas (fecha, profesional_id);

alter table disponibilidad_fechas enable row level security;
drop policy if exists disp_fechas_ver on disponibilidad_fechas;
create policy disp_fechas_ver on disponibilidad_fechas for select using (es_caja());
drop policy if exists disp_fechas_duena on disponibilidad_fechas;
create policy disp_fechas_duena on disponibilidad_fechas for all using (es_duena()) with check (es_duena());

-- ---------- 2) Motivos de consulta ----------
create table if not exists motivos_turno_general (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  nombre text not null,
  descripcion text,
  duracion_min integer not null default 30 check (duracion_min between 15 and 240),
  profesionales_ids uuid[] not null default '{}',
  accion text not null default 'turno' check (accion in ('turno', 'whatsapp', 'ortodoncia')),
  mensaje text,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table motivos_turno_general enable row level security;
drop policy if exists motivos_general_ver on motivos_turno_general;
create policy motivos_general_ver on motivos_turno_general for select using (es_caja());
drop policy if exists motivos_general_duena on motivos_turno_general;
create policy motivos_general_duena on motivos_turno_general for all using (es_duena()) with check (es_duena());

-- Motivos iniciales (se pueden cambiar desde la app). Los profesionales se buscan por nombre.
do $$
declare
  agustin uuid := (select id from profesionales where nombre ilike 'Agust%' order by nombre limit 1);
  santiago uuid := (select id from profesionales where nombre ilike 'Santiago%' order by nombre limit 1);
  catalina uuid := (select id from profesionales where nombre ilike 'Catalina%' order by nombre limit 1);
  yazmin uuid := (select id from profesionales where nombre ilike 'Yazmin%' order by nombre limit 1);
  martin uuid := (select id from profesionales where nombre ilike 'Mart%n%' order by nombre limit 1);
  maria uuid := (select id from profesionales where nombre ilike 'Mar%a Lombardi%' order by nombre limit 1);
begin
  insert into motivos_turno_general (clave, nombre, descripcion, duracion_min, profesionales_ids, accion, mensaje, orden) values
    ('consulta', 'Consulta, revisión o limpieza', 'Primera consulta, revisión general, limpieza o arreglos.', 30, array_remove(array[agustin, santiago], null), 'turno', null, 1),
    ('conducto', 'Conducto o dolor de nervio', 'Consulta de evaluación de endodoncia (tratamiento de conducto).', 30, array_remove(array[agustin, yazmin], null), 'turno', null, 2),
    ('encias', 'Encías (sangrado, sarro)', 'Evaluación de encías: sangrado, sarro, movilidad.', 30, array_remove(array[catalina], null), 'turno', null, 3),
    ('protesis', 'Coronas y prótesis', 'Coronas, puentes y prótesis (dentaduras).', 30, array_remove(array[catalina], null), 'turno', null, 4),
    ('implantes', 'Implantes', 'Consulta para colocar implantes dentales.', 30, array_remove(array[martin], null), 'turno', null, 5),
    ('ninos', 'Niños', 'Odontopediatría: consulta y tratamientos para chicos.', 30, array_remove(array[maria], null), 'turno', null, 6),
    ('ortodoncia', 'Ortodoncia (aparatos)', 'Brackets y tratamientos de ortodoncia.', 30, '{}', 'ortodoncia', null, 7),
    ('urgencia', 'Urgencia o dolor fuerte', 'Dolor fuerte, golpe, diente roto o inflamación.', 30, '{}', 'whatsapp', 'Escribinos por WhatsApp y te damos lugar lo antes posible.', 8)
  on conflict (clave) do nothing;
end $$;

-- ---------- 3) Pedidos: área, motivo y obra social ----------
alter table solicitudes_turno_ortodoncia add column if not exists area text not null default 'Ortodoncia';
alter table solicitudes_turno_ortodoncia drop constraint if exists solicitudes_turno_area_check;
alter table solicitudes_turno_ortodoncia add constraint solicitudes_turno_area_check check (area in ('Ortodoncia', 'General'));
alter table solicitudes_turno_ortodoncia add column if not exists motivo text;
alter table solicitudes_turno_ortodoncia add column if not exists obra_social text;
