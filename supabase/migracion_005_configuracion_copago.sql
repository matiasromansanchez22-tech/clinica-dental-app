-- Migración 005: escala de copago configurable + excepciones por obra social.
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists configuracion_copago_escala (
  id uuid primary key default gen_random_uuid(),
  umbral_maximo numeric, -- null = "en adelante" (sin tope superior)
  porcentaje numeric not null,
  orden integer not null
);

create table if not exists configuracion_copago_excepcion (
  id uuid primary key default gen_random_uuid(),
  obra_social text not null unique,
  porcentaje numeric not null,
  observaciones text
);

insert into configuracion_copago_escala (umbral_maximo, porcentaje, orden) values
  (20000, 70, 1),
  (50000, 60, 2),
  (100000, 50, 3),
  (null, 40, 4);

insert into configuracion_copago_excepcion (obra_social, porcentaje, observaciones) values
  ('IAPOS', 200, 'Fijado por decisión de la dueña: 200% del Valor OS para todas sus prestaciones.');
