-- Migración 003: prepara la base para los datos reales de la clínica
-- (profesionales, disponibilidad, obras sociales, catálogo y nomenclador).
-- Copiar y pegar en Supabase → SQL Editor → Run ("Run without RLS" si te lo pregunta).

-- Los profesionales reales tienen especialidades propias (no solo General/Ortodoncia).
alter table profesionales drop constraint if exists profesionales_especialidad_check;

-- La disponibilidad real indica también el consultorio y si ese bloque está activo.
alter table disponibilidad_profesional
  add column if not exists consultorio integer,
  add column if not exists activo boolean not null default true;

create table if not exists obras_sociales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique
);

create table if not exists catalogo_prestaciones (
  id text primary key, -- ej. "OG-0001"
  especialidad text,
  categoria text,
  prestacion text not null,
  profesional_habilitado text,
  profesional_sugerido text,
  particular boolean not null default false,
  nomenclada boolean not null default false,
  valor_lista numeric not null default 0,
  valor_efectivo numeric not null default 0,
  tiempo_estimado_min integer,
  estado text not null default 'Activo',
  protocolo text,
  requiere_laboratorio boolean not null default false,
  observaciones text,
  activa_obra_social boolean not null default false
);

create table if not exists nomenclador (
  id uuid primary key default gen_random_uuid(),
  obra_social text not null,
  codigo text,
  prestacion_os text not null,
  valor_os numeric not null default 0,
  id_catalogo text references catalogo_prestaciones(id),
  prestacion_interna text,
  copago_oficial numeric not null default 0,
  estado text,
  observaciones text
);

create index if not exists nomenclador_obra_social_idx on nomenclador (obra_social);
create index if not exists nomenclador_id_catalogo_idx on nomenclador (id_catalogo);
