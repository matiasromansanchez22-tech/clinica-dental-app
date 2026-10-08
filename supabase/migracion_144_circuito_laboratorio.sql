-- Migración 144: circuito de Laboratorio con vueltas (envío → llegada → prueba →
-- ajuste → ... → listo para entregar → entregado).
--
-- Agrega dos valores nuevos, sin tocar nada de lo ya cargado:
--  * evento "Prueba aprobada": la prueba con el paciente salió bien.
--  * estado "Listo para entregar": el trabajo está aprobado y falta entregarlo.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table laboratorio_eventos drop constraint if exists laboratorio_eventos_tipo_evento_check;
alter table laboratorio_eventos add constraint laboratorio_eventos_tipo_evento_check
  check (tipo_evento in (
    'Enviado al mecánico', 'Recibido del mecánico', 'Prueba con el paciente',
    'Ajuste - reenviado', 'Prueba aprobada', 'Alta / Entregado'
  ));

alter table laboratorio_trabajos drop constraint if exists laboratorio_trabajos_estado_check;
alter table laboratorio_trabajos add constraint laboratorio_trabajos_estado_check
  check (estado in (
    'Pendiente de envío', 'Enviado al mecánico', 'Recibido del mecánico', 'Prueba con el paciente',
    'Ajuste pendiente', 'Listo para entregar', 'Entregado'
  ));
