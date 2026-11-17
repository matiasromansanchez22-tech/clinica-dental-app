-- Migración 206: la "cortina" de notificaciones de las Dueñas (Matías y Marian).
--
-- Cada vez que el sistema manda un aviso al celular de una Dueña (pedidos de turno, cuentas del mes, resumen de la jornada, cierre del
-- día, avisos de la app...), queda guardado acá para que se pueda volver a leer dentro de la aplicación, aunque se haya cerrado la
-- notificación del celular. Cada Dueña ve solo las suyas: el resumen de la jornada, por ejemplo, es solo para Matías.
-- Los avisos los guarda el servidor; cada Dueña solo puede verlos, marcarlos como leídos y borrarlos.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id) on delete cascade,
  titulo text not null,
  mensaje text,
  url text,
  created_at timestamptz not null default now(),
  leida_en timestamptz
);

create index if not exists notificaciones_usuario_idx on notificaciones (usuario_id, created_at desc);

alter table notificaciones enable row level security;

drop policy if exists notificaciones_ver on notificaciones;
create policy notificaciones_ver on notificaciones for select using (usuario_id = auth.uid());

drop policy if exists notificaciones_marcar on notificaciones;
create policy notificaciones_marcar on notificaciones for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists notificaciones_borrar on notificaciones;
create policy notificaciones_borrar on notificaciones for delete using (usuario_id = auth.uid());
