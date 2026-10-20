-- Migración 158: "Retomar tratamiento" (Ortodoncia).
--
-- Lista de pacientes de Ortodoncia que se alejaron y a los que hay que escribirles para ver si
-- quieren retomar. Acá se guarda el seguimiento de cada uno: a quién ya se le escribió, qué
-- contestó, una nota y la fecha del último contacto. Lo ven y lo cargan las Dueñas y las
-- Secretarias.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists retomar_ortodoncia (
  paciente_id uuid primary key references pacientes_ortodoncia(id) on delete cascade,
  estado text not null default 'Por contactar' check (estado in (
    'Por contactar', 'Mensaje enviado', 'Sin respuesta', 'Quiere retomar',
    'Turno agendado', 'No quiere seguir', 'Ya no es paciente'
  )),
  nota text,
  fecha_ultimo_contacto date,
  usuario_id uuid references perfiles(id) default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table retomar_ortodoncia enable row level security;
drop policy if exists retomar_duenas_y_secretarias on retomar_ortodoncia;
create policy retomar_duenas_y_secretarias on retomar_ortodoncia for all
  using (es_caja()) with check (es_caja());
