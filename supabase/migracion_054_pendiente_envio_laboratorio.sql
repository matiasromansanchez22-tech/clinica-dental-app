-- Migración 054: nuevo estado inicial "Pendiente de envío" para trabajos
-- de laboratorio — al cargar un trabajo ya no queda marcado como enviado
-- al mecánico automáticamente; hay que marcarlo a mano cuando realmente
-- se envía.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table laboratorio_trabajos drop constraint if exists laboratorio_trabajos_estado_check;
alter table laboratorio_trabajos add constraint laboratorio_trabajos_estado_check
  check (estado in ('Pendiente de envío', 'Enviado al mecánico', 'Recibido del mecánico', 'Prueba con el paciente', 'Ajuste pendiente', 'Entregado'));

alter table laboratorio_trabajos alter column estado set default 'Pendiente de envío';
