-- Migración 123: fusionar 2 duplicados más de Ortodoncia, detectados con
-- un escaneo general después del caso de "Diaz Francisco" — ambos se
-- cargaron dos veces el mismo día que se registró el turno/cobro, antes
-- de que existiera el aviso de "posible duplicado" al cargar un paciente.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

-- 1) "Dueñas Luciana": se conserva el registro que tiene el cobro real de
-- $15.000 (id 3399529e...), se le copian el WhatsApp y la fecha de
-- nacimiento del otro, y se le pasa el turno de consulta ya finalizado
-- (para no perder ese historial). Al final se borra el duplicado vacío.
update pacientes_ortodoncia
set whatsapp = '3413 52-7504', fecha_nacimiento = '1992-04-24'
where id = '3399529e-828f-458e-a7f1-e4be1f3424b5';

update turnos_ortodoncia
set paciente_id = '3399529e-828f-458e-a7f1-e4be1f3424b5'
where paciente_id = '4069b729-c1e4-4a7d-8e2c-d6d8de331c02';

delete from pacientes_ortodoncia
where id = '4069b729-c1e4-4a7d-8e2c-d6d8de331c02';

-- 2) "Garcia Nazarena": se conserva el registro con el turno de consulta
-- finalizado y el WhatsApp (id 8d2ae3e1...), se le copia la fecha de
-- nacimiento del otro, y se borra el duplicado (que no tenía turnos ni
-- cobros propios).
update pacientes_ortodoncia
set fecha_nacimiento = '2003-08-28'
where id = '8d2ae3e1-9313-4a92-9b84-1dc1a4bacf39';

delete from pacientes_ortodoncia
where id = 'ca5718ff-8058-4d4e-9123-f8a7f3ec619e';
