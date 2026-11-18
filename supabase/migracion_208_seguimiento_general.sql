-- Migración 208: "Seguimiento de pacientes" (Odontología General).
--
-- La pantalla arma sola la lista de pacientes de General que vinieron a la consulta y quedaron sin continuar: con un presupuesto sin
-- aceptar, que solo hicieron la consulta, o que empezaron el tratamiento y no tienen próximo turno. Acá se guarda el seguimiento de
-- cada uno: a quién ya se le escribió, qué contestó, una nota y la fecha del último contacto. Lo ven y lo cargan las Dueñas y las
-- Secretarias (igual que "Retomar tratamiento" de Ortodoncia).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists seguimiento_general (
  paciente_id uuid primary key references pacientes(id) on delete cascade,
  estado text not null default 'Por contactar' check (estado in (
    'Por contactar', 'Mensaje enviado', 'Sin respuesta', 'Quiere seguir',
    'Turno agendado', 'No quiere seguir', 'Ya no es paciente'
  )),
  nota text,
  fecha_ultimo_contacto date,
  usuario_id uuid references perfiles(id) default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table seguimiento_general enable row level security;
drop policy if exists seguimiento_general_caja on seguimiento_general;
create policy seguimiento_general_caja on seguimiento_general for all
  using (es_caja()) with check (es_caja());
