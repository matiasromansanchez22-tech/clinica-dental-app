-- Migración 002: disponibilidad semanal de cada profesional.
-- Copiar y pegar en Supabase → SQL Editor → Run ("Run without RLS" si te lo pregunta).

alter table profesionales add constraint profesionales_nombre_key unique (nombre);

create table if not exists disponibilidad_profesional (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references profesionales(id) on delete cascade,
  dia_semana integer not null check (dia_semana between 0 and 6), -- 0=Domingo, 1=Lunes, ..., 6=Sábado
  hora_inicio time not null,
  hora_fin time not null
);

-- Datos de ejemplo para poder probar ya mismo (después los ajustamos a los horarios reales).
insert into profesionales (nombre, especialidad) values
  ('Dra. Gómez', 'General'),
  ('Dr. Pérez', 'General')
on conflict (nombre) do nothing;

insert into disponibilidad_profesional (profesional_id, dia_semana, hora_inicio, hora_fin)
select id, dia, '08:00', '14:00'
from profesionales, unnest(array[1, 2, 3, 4, 5]) as dia
where nombre = 'Dra. Gómez';

insert into disponibilidad_profesional (profesional_id, dia_semana, hora_inicio, hora_fin)
select id, dia, '14:00', '20:00'
from profesionales, unnest(array[1, 2, 3, 4, 5]) as dia
where nombre = 'Dr. Pérez';
