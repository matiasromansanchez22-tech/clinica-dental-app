-- Migración 069: notificaciones push — guarda la "suscripción" del
-- navegador/celular de la Dueña para poder mandarle un aviso real cuando
-- se registra un error de la app.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id),
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
drop policy if exists duena_todo on push_subscriptions;
create policy duena_todo on push_subscriptions for all using (es_duena()) with check (es_duena());
