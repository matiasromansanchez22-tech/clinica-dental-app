-- Migración 147: recordatorios en la Agenda — notas puntuales para un día
-- ("llamar a Dental Pin", "traer insumos"), con un aviso opcional a una hora
-- elegida. Los crean y ven las Dueñas y las Secretarias (es_caja()); nadie más.
--
-- agenda: en qué Agenda se muestra ('General', 'Ortodoncia' o 'Ambas').
-- hora_aviso: si tiene hora, ese día a esa hora aparece un aviso en pantalla y
--   llega un push a Dueñas y Secretarias. aviso_enviado_at evita mandar el push
--   dos veces si hay varias pantallas abiertas.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists recordatorios_agenda (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  texto text not null,
  agenda text not null default 'Ambas' check (agenda in ('General', 'Ortodoncia', 'Ambas')),
  hora_aviso time,
  hecho boolean not null default false,
  hecho_por uuid references perfiles(id),
  hecho_at timestamptz,
  aviso_enviado_at timestamptz,
  creado_por uuid references perfiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists recordatorios_agenda_fecha_idx on recordatorios_agenda (fecha);

alter table recordatorios_agenda enable row level security;
drop policy if exists recordatorios_duenas_y_secretarias on recordatorios_agenda;
create policy recordatorios_duenas_y_secretarias on recordatorios_agenda for all
  using (es_caja()) with check (es_caja());
