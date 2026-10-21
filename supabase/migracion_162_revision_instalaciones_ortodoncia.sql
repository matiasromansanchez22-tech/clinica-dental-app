-- Migración 162: revisión manual en el "Control de instalaciones" de Ortodoncia.
--
-- Cuando el control marca a un paciente como "instalado y sin pago registrado" pero en realidad ya estaba instalado antes de la
-- app, no se instaló, o se pagó por otro lado, las dueñas lo dejan anotado acá y ya no cuenta como alerta.
-- Solo lo ven y lo cargan las Dueñas.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists revision_instalaciones_ortodoncia (
  paciente_id uuid primary key references pacientes_ortodoncia(id) on delete cascade,
  resultado text not null check (resultado in (
    'Ya estaba instalado antes de la app', 'No se instaló', 'Pago registrado afuera', 'Descuento autorizado'
  )),
  nota text,
  usuario_id uuid references perfiles(id) default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table revision_instalaciones_ortodoncia enable row level security;
drop policy if exists revision_instalaciones_duenas on revision_instalaciones_ortodoncia;
create policy revision_instalaciones_duenas on revision_instalaciones_ortodoncia for all
  using (es_duena()) with check (es_duena());
