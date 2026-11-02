-- Migración 184: el plan de la rutina semanal pasa a ser editable (Gerencial → Mi rutina semanal).
--
-- Cada dueña puede agregar, editar, borrar y reordenar las tareas de cada bloque, y cambiar el tema y la frase de
-- cada día. El plan modificado se guarda acá, entero, en una sola fila por dueña. Si no hay fila, se usa el plan
-- base de la app. «Volver al plan original» borra la fila.
--
-- Para DESHACER: drop table rutina_plan;
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists rutina_plan (
  usuario_id uuid primary key default auth.uid() references perfiles(id) on delete cascade,
  plan jsonb not null,
  updated_at timestamptz not null default now()
);

alter table rutina_plan enable row level security;
drop policy if exists rutina_plan_propio on rutina_plan;
create policy rutina_plan_propio on rutina_plan for all
  using (es_duena() and usuario_id = auth.uid())
  with check (es_duena() and usuario_id = auth.uid());
