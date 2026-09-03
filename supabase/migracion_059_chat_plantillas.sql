-- Migración 059: Plantillas del chat interno — frases guardadas que
-- cualquiera puede crear y usar con un clic para escribir más rápido
-- (ej. "Turno confirmado", "El paciente no se presentó").
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists chat_plantillas (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  autor_id uuid not null references perfiles(id),
  created_at timestamptz not null default now()
);

alter table chat_plantillas enable row level security;

drop policy if exists chat_plantillas_leer on chat_plantillas;
create policy chat_plantillas_leer on chat_plantillas for select using (es_staff());

drop policy if exists chat_plantillas_crear on chat_plantillas;
create policy chat_plantillas_crear on chat_plantillas for insert with check (es_staff() and autor_id = auth.uid());

-- Cada uno puede borrar las plantillas que creó, y la Dueña cualquiera.
drop policy if exists chat_plantillas_borrar on chat_plantillas;
create policy chat_plantillas_borrar on chat_plantillas for delete using (autor_id = auth.uid() or es_duena());
