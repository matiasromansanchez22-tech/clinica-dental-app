-- Esquema inicial: Odontología General (Pacientes + Turnos).
-- Copiar y pegar todo este archivo en Supabase → SQL Editor → Run.
-- Basado en Especificacion_Tecnica_Sistema_Clinica_Dental.docx, secciones 3.1, 3.2 y 9.

create table if not exists profesionales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  especialidad text not null check (especialidad in ('General', 'Ortodoncia')),
  created_at timestamptz not null default now()
);

create table if not exists pacientes (
  id uuid primary key default gen_random_uuid(),
  apellido_y_nombre text not null,
  dni text,
  celular text,
  fecha_nacimiento date,
  profesional_responsable_id uuid references profesionales(id),
  tipo_paciente text not null default 'Particular' check (tipo_paciente in ('Particular', 'Obra Social')),
  obra_social text,
  numero_afiliado text,
  estado text not null default 'Activo' check (estado in ('Activo', 'Inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Regla del doc 3.2: detectar posibles duplicados de pacientes por DNI.
create index if not exists pacientes_dni_idx on pacientes (dni);
create index if not exists pacientes_apellido_y_nombre_idx on pacientes (apellido_y_nombre);

create table if not exists turnos_general (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora_inicio time not null,
  duracion_min integer not null default 30,
  consultorio integer not null check (consultorio in (1, 2, 3)),
  paciente_id uuid references pacientes(id),
  celular text,
  profesional_responsable_id uuid references profesionales(id),
  profesional_de_turno_id uuid references profesionales(id),
  tipo_atencion text not null check (
    tipo_atencion in ('Primera consulta', 'Consulta', 'Tratamiento', 'Control', 'Urgencia', 'Obra social')
  ),
  cobertura text not null default 'Particular',
  numero_afiliado text,
  prioridad text not null default 'Normal' check (prioridad in ('Normal', 'Alta', 'Urgente')),
  prestaciones jsonb not null default '[]', -- hasta 4 objetos: { "nombre": "...", "duracion_min": 30 }
  estado text not null default 'Agendado' check (estado in ('Pendiente', 'Agendado', 'Reprogramado', 'Cancelado')),
  confirmacion text not null default 'Sin confirmar' check (
    confirmacion in ('Sin confirmar', 'Confirmado', 'No responde', 'Reprogramar')
  ),
  presencia text not null default 'Pendiente' check (
    presencia in ('Pendiente', 'En espera', 'En consultorio', 'Finalizado')
  ),
  asistencia text not null default 'Pendiente' check (
    asistencia in ('Pendiente', 'Asistió', 'No asistió', 'Canceló')
  ),
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists turnos_general_fecha_consultorio_idx on turnos_general (fecha, consultorio);

-- Por ahora dejamos la seguridad por fila (RLS) desactivada: es un sistema
-- interno de uso exclusivo del personal de la clínica, todavía sin login.
-- Cuando sumemos usuarios con roles (secretaria / odontólogo / dueña),
-- vamos a activar RLS con políticas según ese rol.
