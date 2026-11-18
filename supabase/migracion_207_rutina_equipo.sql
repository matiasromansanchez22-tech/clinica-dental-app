-- Migración 207: la rutina de trabajo del equipo (hojas por rol, tareas, quién tiene cada hoja y lo que se va tildando día a día).
--
-- Cada persona del equipo tiene UNA hoja de rutina (Odontólogos, Encargada de odontología, Secretario de la mañana, Secretaria de la
-- tarde, Asistentes) con sus tareas agrupadas por momento del día. Cada día tilda lo que hizo desde la pantalla "Mi rutina de hoy":
-- queda guardado con la hora exacta y, si la tarea lo pide, un valor (por ejemplo el % de la agenda organizada).
-- Algunas tareas las comprueba el propio sistema (horario marcado, ingreso del profesional, "qué se hizo" cargado, consentimientos,
-- fotos y panorámicas): en la pantalla de control de las Dueñas se ve cuáles están comprobadas y cuáles solo declaradas, y cada Dueña
-- puede marcar «Visto» lo declarado.
--
-- Cada persona ve y tilda solo lo suyo y solo el día de hoy; las Dueñas ven todo, editan las hojas y marcan lo visto.
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists rutina_equipo_hojas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden integer not null default 0,
  -- A qué hora del día se evalúa si la hoja está completa: 'manana' (aviso de las 12:30) o 'tarde' (aviso de las 18:30).
  corte text not null default 'tarde' check (corte in ('manana', 'tarde')),
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists rutina_equipo_tareas (
  id uuid primary key default gen_random_uuid(),
  hoja_id uuid not null references rutina_equipo_hojas(id) on delete cascade,
  momento text not null,
  orden integer not null default 0,
  texto text not null,
  -- Cómo la comprueba el sistema (null = solo se declara): horario, ingreso_profesional, que_se_hizo, cierre_manana, cierre_tarde,
  -- consentimientos_manana, fotos_panoramicas.
  verificacion text,
  -- Si la tarea pide un número al tildarla, la pregunta (por ejemplo "¿Qué % de la agenda de mañana quedó organizada?").
  pide_valor text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists rutina_equipo_tareas_hoja_idx on rutina_equipo_tareas (hoja_id, orden);

create table if not exists rutina_equipo_asignaciones (
  usuario_id uuid primary key references perfiles(id) on delete cascade,
  hoja_id uuid not null references rutina_equipo_hojas(id) on delete cascade
);

create table if not exists rutina_equipo_tildes (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references rutina_equipo_tareas(id) on delete cascade,
  usuario_id uuid not null references perfiles(id) on delete cascade,
  fecha date not null,
  hecho_en timestamptz not null default now(),
  valor text,
  visto_por uuid references perfiles(id),
  visto_en timestamptz,
  unique (tarea_id, usuario_id, fecha)
);

create index if not exists rutina_equipo_tildes_fecha_idx on rutina_equipo_tildes (fecha desc, usuario_id);

alter table rutina_equipo_hojas enable row level security;
alter table rutina_equipo_tareas enable row level security;
alter table rutina_equipo_asignaciones enable row level security;
alter table rutina_equipo_tildes enable row level security;

-- Hojas y tareas: las ve cualquier persona con sesión; solo las Dueñas las editan.
drop policy if exists rutina_hojas_ver on rutina_equipo_hojas;
create policy rutina_hojas_ver on rutina_equipo_hojas for select using (auth.uid() is not null);
drop policy if exists rutina_hojas_editar on rutina_equipo_hojas;
create policy rutina_hojas_editar on rutina_equipo_hojas for all using (es_duena()) with check (es_duena());

drop policy if exists rutina_tareas_ver on rutina_equipo_tareas;
create policy rutina_tareas_ver on rutina_equipo_tareas for select using (auth.uid() is not null);
drop policy if exists rutina_tareas_editar on rutina_equipo_tareas;
create policy rutina_tareas_editar on rutina_equipo_tareas for all using (es_duena()) with check (es_duena());

-- Asignaciones: cada persona ve la suya; las Dueñas ven y editan todas.
drop policy if exists rutina_asig_ver on rutina_equipo_asignaciones;
create policy rutina_asig_ver on rutina_equipo_asignaciones for select using (usuario_id = auth.uid() or es_duena());
drop policy if exists rutina_asig_editar on rutina_equipo_asignaciones;
create policy rutina_asig_editar on rutina_equipo_asignaciones for all using (es_duena()) with check (es_duena());

-- Tildes: cada persona ve los suyos y tilda/destilda solo hoy (hora de Argentina), y no puede destildar lo que una Dueña ya vio.
-- Las Dueñas ven todos y son las únicas que pueden actualizarlos (marcar «Visto»).
drop policy if exists rutina_tildes_ver on rutina_equipo_tildes;
create policy rutina_tildes_ver on rutina_equipo_tildes for select using (usuario_id = auth.uid() or es_duena());

drop policy if exists rutina_tildes_crear on rutina_equipo_tildes;
create policy rutina_tildes_crear on rutina_equipo_tildes for insert
  with check (usuario_id = auth.uid() and fecha = (now() at time zone 'America/Argentina/Buenos_Aires')::date and visto_por is null);

drop policy if exists rutina_tildes_borrar on rutina_equipo_tildes;
create policy rutina_tildes_borrar on rutina_equipo_tildes for delete
  using (es_duena() or (usuario_id = auth.uid() and fecha = (now() at time zone 'America/Argentina/Buenos_Aires')::date and visto_por is null));

drop policy if exists rutina_tildes_visto on rutina_equipo_tildes;
create policy rutina_tildes_visto on rutina_equipo_tildes for update using (es_duena()) with check (es_duena());

-- Que cada profesional pueda ver sus propios ingresos (para ver la comprobación en su pantalla).
drop policy if exists ingresos_prof_ver_propio on ingresos_profesionales;
create policy ingresos_prof_ver_propio on ingresos_profesionales for select
  using (profesional_id = (select p.profesional_id from perfiles p where p.id = auth.uid()));

-- ====================== Hojas y tareas iniciales ======================
insert into rutina_equipo_hojas (nombre, orden, corte) values
  ('Odontólogos', 1, 'tarde'),
  ('Encargada de odontología', 2, 'tarde'),
  ('Secretario administrativo (mañana)', 3, 'manana'),
  ('Secretaria (tarde)', 4, 'tarde'),
  ('Asistentes', 5, 'tarde')
on conflict (nombre) do nothing;

insert into rutina_equipo_tareas (hoja_id, momento, orden, texto, verificacion, pide_valor)
select h.id, t.momento, t.orden, t.texto, t.verificacion, t.pide_valor
from (values
  -- Odontólogos
  ('Odontólogos', '1. Antes de empezar · llegar 15 minutos antes', 1, 'Llegué 15 minutos antes y marqué mi ingreso', 'ingreso_profesional', null),
  ('Odontólogos', '1. Antes de empezar · llegar 15 minutos antes', 2, 'Revisé la agenda del día: quién viene y a qué', null, null),
  ('Odontólogos', '1. Antes de empezar · llegar 15 minutos antes', 3, 'Revisé las planillas que me dejó el secretario o la secretaria', null, null),
  ('Odontólogos', '1. Antes de empezar · llegar 15 minutos antes', 4, 'Revisé las fichas: historia clínica completa y consentimiento firmado', null, null),
  ('Odontólogos', '1. Antes de empezar · llegar 15 minutos antes', 5, 'Mi box está listo y todo estéril: recién ahí empiezo a atender', null, null),
  ('Odontólogos', '2. Durante la jornada', 6, 'Instrumental estéril en cada paciente, sin excepción', null, null),
  ('Odontólogos', '2. Durante la jornada', 7, 'Consentimiento firmado antes de empezar cada tratamiento', null, null),
  ('Odontólogos', '2. Durante la jornada', 8, 'Apenas termino cada paciente marco QUÉ HICE y QUÉ SIGUE en la app', null, null),
  ('Odontólogos', '3. Al cerrar la mañana y la tarde', 9, 'Todos mis pacientes con «qué se hizo» y «qué sigue» cargados (mañana: antes de las 12:30 · tarde: antes de las 18:30)', 'que_se_hizo', null),
  ('Odontólogos', '3. Al cerrar la mañana y la tarde', 10, 'Box ordenado y material entregado para esterilizar', null, null),
  -- Encargada de odontología
  ('Encargada de odontología', '1. Al llegar', 1, 'Marqué mi horario', 'horario', null),
  ('Encargada de odontología', '1. Al llegar', 2, 'Revisé qué profesionales dejaron pacientes sin marcar qué hicieron y se los reclamé', null, null),
  ('Encargada de odontología', '2. Durante el día', 3, 'Cierre de la mañana: todos los profesionales marcaron qué hicieron y qué van a hacer la próxima vez', 'cierre_manana', null),
  ('Encargada de odontología', '2. Durante el día', 4, 'Fichas de MAÑANA: miré a qué viene cada paciente', null, null),
  ('Encargada de odontología', '2. Durante el día', 5, 'Fichas de MAÑANA: todos tienen el consentimiento firmado', 'consentimientos_manana', null),
  ('Encargada de odontología', '2. Durante el día', 6, 'Fichas de MAÑANA: la historia clínica está completa', null, null),
  ('Encargada de odontología', '2. Durante el día', 7, 'Armé las planillas de colores de mañana', null, null),
  ('Encargada de odontología', '2. Durante el día', 8, 'Cierre de la tarde: todos los profesionales marcaron qué hicieron y qué van a hacer la próxima vez', 'cierre_tarde', null),
  ('Encargada de odontología', '3. 2 horas antes de terminar el día', 9, 'Rellené los rodantes', null, null),
  ('Encargada de odontología', '4. Antes de irme', 10, 'Cargué las fotos y las panorámicas del día', 'fotos_panoramicas', null),
  ('Encargada de odontología', '4. Antes de irme', 11, 'Le avisé a Matías si quedó algo sin cumplir', null, null),
  -- Secretario administrativo (mañana)
  ('Secretario administrativo (mañana)', '1. Apenas llego', 1, 'Marqué mi horario', 'horario', null),
  ('Secretario administrativo (mañana)', '1. Apenas llego', 2, 'Envié los recordatorios del día siguiente', null, null),
  ('Secretario administrativo (mañana)', '1. Apenas llego', 3, 'Chequeé los pacientes autorizados de obra social', null, null),
  ('Secretario administrativo (mañana)', '1. Apenas llego', 4, 'Revisé qué fichas quedaron sin cargar en la app', null, null),
  ('Secretario administrativo (mañana)', '2. Durante la mañana', 5, 'Busqué las fichas de mañana (turno mañana) y separé las que faltan enviar a autorizar', null, null),
  ('Secretario administrativo (mañana)', '2. Durante la mañana', 6, 'Envié a autorizar las fichas que faltaban', null, null),
  ('Secretario administrativo (mañana)', '2. Durante la mañana', 7, 'Acomodé por WhatsApp la agenda del día siguiente', null, null),
  ('Secretario administrativo (mañana)', '2. Durante la mañana', 8, 'Coordiné turnos nuevos usando siempre las respuestas rápidas', null, null),
  ('Secretario administrativo (mañana)', '2. Durante la mañana', 9, 'WhatsApp en 0 y todo muy bien respondido', null, null),
  ('Secretario administrativo (mañana)', '3. Antes de finalizar mi turno', 10, 'La agenda de mañana está organizada al menos en un 60%', null, '¿Qué porcentaje de la agenda de mañana quedó organizado? (mínimo 60)'),
  ('Secretario administrativo (mañana)', '3. Antes de finalizar mi turno', 11, 'Le dejé a Lola lo que falta para terminar', null, null),
  -- Secretaria (tarde)
  ('Secretaria (tarde)', '1. Apenas llego', 1, 'Marqué mi horario', 'horario', null),
  ('Secretaria (tarde)', '1. Apenas llego', 2, 'Revisé lo que me dejó Simón para terminar', null, null),
  ('Secretaria (tarde)', '2. Durante la tarde', 3, 'Terminé de acomodar la agenda del día siguiente', null, '¿Qué porcentaje de la agenda de mañana quedó organizado? (tiene que llegar a 100)'),
  ('Secretaria (tarde)', '2. Durante la tarde', 4, 'Busqué las fichas de mañana del turno tarde y se las dejé a Yamila para que trabaje', null, null),
  ('Secretaria (tarde)', '2. Durante la tarde', 5, 'Coordiné turnos nuevos usando siempre las respuestas rápidas', null, null),
  ('Secretaria (tarde)', '2. Durante la tarde', 6, 'WhatsApp en 0 y todo muy bien respondido', null, null),
  ('Secretaria (tarde)', '3. Antes de finalizar mi turno', 7, 'La agenda de mañana está completa y sin turnos sueltos', null, null),
  ('Secretaria (tarde)', '3. Antes de finalizar mi turno', 8, 'WhatsApp en 0 antes de irme', null, null),
  -- Asistentes (borrador a revisar)
  ('Asistentes', '1. Al llegar', 1, 'Marqué mi horario', 'horario', null),
  ('Asistentes', '1. Al llegar', 2, 'Box preparado y estéril ANTES de que llegue el profesional', null, null),
  ('Asistentes', '1. Al llegar', 3, 'Material y descartables completos en el box', null, null),
  ('Asistentes', '2. Durante la jornada', 4, 'Esterilización al día: instrumental listo para el siguiente paciente', null, null),
  ('Asistentes', '2. Durante la jornada', 5, 'Box limpio y desinfectado entre cada paciente', null, null),
  ('Asistentes', '3. Antes de irme', 6, 'Instrumental entregado a esterilizar y box ordenado', null, null),
  ('Asistentes', '3. Antes de irme', 7, 'Avisé qué material falta reponer', null, null)
) as t(hoja, momento, orden, texto, verificacion, pide_valor)
join rutina_equipo_hojas h on h.nombre = t.hoja
where not exists (select 1 from rutina_equipo_tareas x where x.hoja_id = h.id);

-- Quién tiene cada hoja (se puede cambiar desde la pantalla de control): todos los Odontólogos, Yamila, Simón, Lola y las Asistentes.
insert into rutina_equipo_asignaciones (usuario_id, hoja_id)
select p.id, h.id
from perfiles p
join rutina_equipo_hojas h on h.nombre = case
  when p.rol = 'Odontologo' then 'Odontólogos'
  when p.rol = 'Asistente' then 'Asistentes'
  when p.nombre ilike 'yamila%' then 'Encargada de odontología'
  when p.nombre ilike 'sim_n%' then 'Secretario administrativo (mañana)'
  when p.nombre ilike 'lola%' then 'Secretaria (tarde)'
end
on conflict (usuario_id) do nothing;
