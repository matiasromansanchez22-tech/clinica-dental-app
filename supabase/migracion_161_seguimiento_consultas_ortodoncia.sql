-- Migración 161: seguimiento de las consultas de Ortodoncia que todavía no tienen turno de instalación.
--
-- Guarda, por paciente, a quién ya se le escribió, qué contestó (lo está pensando, quiere instalar, etc.),
-- una nota y la fecha del último contacto. Lo ven y lo cargan las Dueñas y las Secretarias.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists seguimiento_consultas_ortodoncia (
  paciente_id uuid primary key references pacientes_ortodoncia(id) on delete cascade,
  estado text not null default 'Por contactar' check (estado in (
    'Por contactar', 'Mensaje enviado', 'Sin respuesta', 'Lo está pensando',
    'Quiere instalar', 'Instalación agendada', 'No va a hacer ortodoncia'
  )),
  nota text,
  fecha_ultimo_contacto date,
  usuario_id uuid references perfiles(id) default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table seguimiento_consultas_ortodoncia enable row level security;
drop policy if exists seguimiento_consultas_duenas_y_secretarias on seguimiento_consultas_ortodoncia;
create policy seguimiento_consultas_duenas_y_secretarias on seguimiento_consultas_ortodoncia for all
  using (es_caja()) with check (es_caja());
