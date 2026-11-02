-- Migración 183: registro de la rutina semanal de las dueñas (Gerencial → Mi rutina semanal).
--
-- Una fila por dueña y por día, con:
--   · turno: "manana" o "tarde" (a qué turno vino ese día)
--   · hechos: las tareas tildadas, como { "arranque-0": true, "foco-2": true, ... }
--   · prioridades: las 3 prioridades del día
--   · notas: qué quedó pendiente al cerrar
-- Cada dueña ve y escribe solo lo suyo.
--
-- Para DESHACER: drop table rutina_registro;
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists rutina_registro (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references perfiles(id) on delete cascade,
  fecha date not null,
  turno text check (turno in ('manana', 'tarde')),
  hechos jsonb not null default '{}'::jsonb,
  prioridades text[] not null default '{}',
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (usuario_id, fecha)
);

create index if not exists rutina_registro_fecha_idx on rutina_registro (usuario_id, fecha);

alter table rutina_registro enable row level security;
drop policy if exists rutina_registro_propio on rutina_registro;
create policy rutina_registro_propio on rutina_registro for all
  using (es_duena() and usuario_id = auth.uid())
  with check (es_duena() and usuario_id = auth.uid());
