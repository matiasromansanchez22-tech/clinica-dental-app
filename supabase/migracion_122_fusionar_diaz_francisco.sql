-- Migración 122: fusionar el paciente de Ortodoncia "Diaz Francisco"
-- duplicado (cargado dos veces: una con tilde y otra sin tilde).
--
-- El registro CON tilde ("Díaz Francisco", id 371adc4a...) solo tiene 2
-- turnos de Consulta ya Cancelados, sin cobros ni ficha clínica — pero
-- tenía el WhatsApp cargado, que el otro registro no tiene.
--
-- El registro SIN tilde ("Diaz Francisco", id 80ca38e2...) es el que
-- sigue en uso: tiene un cobro real, la ficha clínica completa y el
-- turno de "Instalación superior" de hoy. Antes de borrar el duplicado,
-- le copiamos el WhatsApp para no perder ese dato.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

update pacientes_ortodoncia
set whatsapp = '3364 52-4168'
where id = '80ca38e2-6767-463a-a5f8-2ee36f87f3b4';

delete from turnos_ortodoncia
where paciente_id = '371adc4a-2f7b-45dc-8eae-1d2e5cd4a53b';

delete from pacientes_ortodoncia
where id = '371adc4a-2f7b-45dc-8eae-1d2e5cd4a53b';
