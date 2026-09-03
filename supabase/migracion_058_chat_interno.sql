-- Migración 058: Chat interno del personal — una sala grupal única
-- donde todo el personal (odontólogos, secretarias, laboratorio, dueña)
-- puede escribir y leer mensajes en vivo, para coordinar el día a día.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists chat_mensajes (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references perfiles(id),
  texto text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_mensajes_created_idx on chat_mensajes (created_at);

alter table chat_mensajes enable row level security;

drop policy if exists chat_mensajes_leer on chat_mensajes;
create policy chat_mensajes_leer on chat_mensajes for select using (es_staff());

drop policy if exists chat_mensajes_escribir on chat_mensajes;
create policy chat_mensajes_escribir on chat_mensajes for insert with check (es_staff() and autor_id = auth.uid());

-- Cada uno puede borrar sus propios mensajes (para corregir un error), y
-- la Dueña puede borrar cualquiera si hace falta moderar algo.
drop policy if exists chat_mensajes_borrar on chat_mensajes;
create policy chat_mensajes_borrar on chat_mensajes for delete using (autor_id = auth.uid() or es_duena());

-- Habilita que los mensajes nuevos lleguen en vivo a todos sin recargar.
alter publication supabase_realtime add table chat_mensajes;
