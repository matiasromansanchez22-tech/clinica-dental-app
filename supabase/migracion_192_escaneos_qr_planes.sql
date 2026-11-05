-- Migración 192: control de escaneos del QR de los planes (fidelidad y referidos de Ortodoncia).
--
-- qr_lugares: dónde está cada cartel con QR (sala de espera, consultorios, recepción, redes...). Cada lugar tiene su
--             propio link, así se sabe de cuál cartel viene cada escaneo.
-- qr_escaneos: una fila por cada vez que alguien abre la página desde el QR. No se guarda ningún dato personal:
--              solo la fecha y hora, el lugar, un código anónimo del celular y el tipo de dispositivo.
--              Los escaneos los registra la aplicación (no se pueden cargar a mano desde afuera).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists qr_lugares (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique check (clave ~ '^[a-z0-9-]{1,40}$'),
  nombre text not null,
  orden int not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into qr_lugares (clave, nombre, orden) values
  ('general', 'Cartel sin lugar (el que ya está impreso)', 0),
  ('sala-espera', 'Sala de espera', 1),
  ('consultorio-2', 'Consultorio 2', 2),
  ('consultorio-3', 'Consultorio 3', 3),
  ('recepcion', 'Recepción', 4),
  ('instagram', 'Instagram', 5),
  ('whatsapp', 'WhatsApp', 6)
on conflict (clave) do nothing;

create table if not exists qr_escaneos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lugar text not null default 'general',
  visitante text not null,
  dispositivo text not null default 'Celular' check (dispositivo in ('Celular', 'Tablet', 'Computadora'))
);
create index if not exists qr_escaneos_created_idx on qr_escaneos (created_at desc);
create index if not exists qr_escaneos_visitante_idx on qr_escaneos (visitante, lugar, created_at desc);

alter table qr_lugares enable row level security;
drop policy if exists duena_todo on qr_lugares;
create policy duena_todo on qr_lugares for all using (es_duena()) with check (es_duena());

alter table qr_escaneos enable row level security;
drop policy if exists duena_lee on qr_escaneos;
create policy duena_lee on qr_escaneos for select using (es_duena());
