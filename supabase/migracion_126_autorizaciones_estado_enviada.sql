-- Migración 126: agrega el estado "Enviada" a las autorizaciones de obras
-- sociales (la ficha ya se mandó a la obra social y se espera la
-- respuesta) y la fecha en que se envió.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table autorizaciones_obra_social add column if not exists fecha_envio date;

alter table autorizaciones_obra_social drop constraint if exists autorizaciones_obra_social_estado_check;
alter table autorizaciones_obra_social add constraint autorizaciones_obra_social_estado_check
  check (estado in ('Para autorizar', 'Enviada', 'Autorizada'));
