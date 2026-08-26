alter table pacientes_ortodoncia
  add column if not exists origen_paciente text check (origen_paciente in ('Nuevo', 'Continuación de otra clínica')),
  add column if not exists clinica_procedencia text;
