-- Migración 199: consultas online de Ortodoncia (la página pública /ortodoncia-info).
--
-- 1) consulta_publica_horarios: los bloques semanales (día, desde, hasta, ortodoncista, consultorio) en los que se ofrecen turnos de
--    primera consulta en la página. Los carga la Dueña; hasta que no haya ninguno, la página no muestra horarios.
-- 2) solicitudes_turno_ortodoncia: cada pedido de turno que hace un paciente desde la página (nombre, WhatsApp, día y hora). Queda
--    "Pendiente" hasta que Recepción lo agenda (se crea el turno en la Agenda) o lo rechaza. Un pedido pendiente reserva ese horario.
--    Los pedidos los carga la propia aplicación (no se pueden cargar a mano desde afuera).
-- 3) chat_publico_log: lo que pregunta la gente al asistente de la página y lo que responde, de forma anónima (sin nombre ni
--    teléfono). Sirve para saber qué dudas tienen y para frenar abusos.
-- 4) galeria_casos: los casos (fotos de antes y después) que se muestran en la página. Solo se pueden publicar con la autorización
--    firmada del paciente tildada y con las dos fotos. Las fotos van a un almacenamiento público llamado "galeria".
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

-- ---------- 1) Horarios habilitados para consultas online ----------
create table if not exists consulta_publica_horarios (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references profesionales(id),
  dia_semana integer not null check (dia_semana between 0 and 6), -- 0=Domingo, 1=Lunes, ..., 6=Sábado
  hora_inicio time not null,
  hora_fin time not null,
  consultorio integer not null check (consultorio in (2, 3)),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  check (hora_fin > hora_inicio)
);

alter table consulta_publica_horarios enable row level security;
drop policy if exists consulta_horarios_duena on consulta_publica_horarios;
create policy consulta_horarios_duena on consulta_publica_horarios for all using (es_duena()) with check (es_duena());
drop policy if exists consulta_horarios_secretaria_ve on consulta_publica_horarios;
create policy consulta_horarios_secretaria_ve on consulta_publica_horarios for select using (es_caja());

-- ---------- 2) Pedidos de turno hechos desde la página ----------
create table if not exists solicitudes_turno_ortodoncia (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null,
  whatsapp text not null,
  fecha date not null,
  hora_inicio time not null,
  duracion_min integer not null default 30,
  profesional_id uuid references profesionales(id),
  consultorio integer,
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'Agendada', 'Rechazada', 'Cancelada')),
  lugar text,            -- de qué cartel o medio vino (sala-espera, instagram, whatsapp...)
  ip_hash text,          -- código anónimo de la conexión, solo para frenar abusos
  turno_id uuid,         -- el turno que se creó en la Agenda al agendarla
  paciente_id uuid,      -- la ficha de paciente (en "Consulta") que se usó o se creó
  nota text,
  gestionada_en timestamptz
);
create index if not exists solicitudes_turno_estado_idx on solicitudes_turno_ortodoncia (estado, fecha, hora_inicio);
create index if not exists solicitudes_turno_ip_idx on solicitudes_turno_ortodoncia (ip_hash, created_at desc);

alter table solicitudes_turno_ortodoncia enable row level security;
drop policy if exists solicitudes_turno_caja on solicitudes_turno_ortodoncia;
create policy solicitudes_turno_caja on solicitudes_turno_ortodoncia for all using (es_caja()) with check (es_caja());

-- ---------- 3) Registro anónimo del asistente ----------
create table if not exists chat_publico_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ip_hash text,
  pregunta text not null,
  respuesta text
);
create index if not exists chat_publico_log_ip_idx on chat_publico_log (ip_hash, created_at desc);
create index if not exists chat_publico_log_fecha_idx on chat_publico_log (created_at desc);

alter table chat_publico_log enable row level security;
drop policy if exists chat_publico_log_duena on chat_publico_log;
create policy chat_publico_log_duena on chat_publico_log for all using (es_duena()) with check (es_duena());

-- ---------- 4) Galería de casos ----------
create table if not exists galeria_casos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  titulo text not null,
  descripcion text,
  tratamiento text,
  duracion_meses integer,
  foto_antes text,   -- ruta del archivo dentro del almacenamiento "galeria"
  foto_despues text,
  consentimiento boolean not null default false, -- el paciente firmó la autorización de uso de imagen
  publicado boolean not null default false,
  orden integer not null default 0,
  check (not publicado or (consentimiento and foto_antes is not null and foto_despues is not null))
);

alter table galeria_casos enable row level security;
drop policy if exists galeria_casos_duena_cm on galeria_casos;
create policy galeria_casos_duena_cm on galeria_casos for all using (es_duena() or es_cm()) with check (es_duena() or es_cm());

-- Almacenamiento público para las fotos (cualquiera con el link puede verlas; los nombres son largos e imposibles de adivinar).
-- Solo la Dueña y la persona de Marketing pueden subir o borrar.
insert into storage.buckets (id, name, public)
values ('galeria', 'galeria', true)
on conflict (id) do nothing;

drop policy if exists galeria_storage_subir on storage.objects;
create policy galeria_storage_subir on storage.objects for insert
  with check (bucket_id = 'galeria' and (es_duena() or es_cm()));

drop policy if exists galeria_storage_borrar on storage.objects;
create policy galeria_storage_borrar on storage.objects for delete
  using (bucket_id = 'galeria' and (es_duena() or es_cm()));
