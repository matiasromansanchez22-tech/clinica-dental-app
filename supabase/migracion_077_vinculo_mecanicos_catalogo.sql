-- Migración 077: la comparativa de precios de mecánicos usa los nombres que
-- ELLOS le ponen a cada trabajo (ej. "Corona Zirconio Layer"), que muchas
-- veces no coinciden con el nombre que tiene esa misma prestación en
-- nuestro catálogo (ej. "Corona de Zirconio") — eso generaba confusión y
-- trabajos de laboratorio que no quedaban vinculados a ningún ítem del
-- catálogo para calcular el margen.
--
-- Esta migración agrega un vínculo explícito, por fila de mecanicos_precios,
-- hacia la prestación del catálogo que realmente es — así el margen se
-- calcula bien sin depender de que el nombre coincida letra por letra.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table mecanicos_precios
  add column if not exists id_catalogo text references catalogo_prestaciones(id);

-- Dado un laboratorio + nombre de trabajo (tal como se escribió al cargar
-- el trabajo de laboratorio), devuelve el id de catálogo ya vinculado en la
-- comparativa de precios — sin exponer el resto de la tabla (precios de
-- otros mecánicos, contactos, etc.), igual que obtener_precio_mecanico.
create or replace function obtener_id_catalogo_mecanico(p_laboratorio text, p_trabajo text)
returns text
language sql
security definer
set search_path = public
as $$
  select id_catalogo
  from mecanicos_precios
  where lower(laboratorio) = lower(p_laboratorio)
    and lower(trabajo) = lower(p_trabajo)
  limit 1;
$$;

grant execute on function obtener_id_catalogo_mecanico(text, text) to authenticated;

-- Nombres de trabajo que ese mecánico puntual usa (sin precios ni
-- contactos), para sugerir mientras se escribe el "Tipo de trabajo" al
-- cargar un trabajo de laboratorio — así se usa el nombre que el mecánico
-- reconoce, en vez de forzar el nombre del catálogo.
create or replace function obtener_trabajos_mecanico(p_laboratorio text)
returns table (trabajo text)
language sql
security definer
set search_path = public
as $$
  select distinct trabajo from mecanicos_precios where lower(laboratorio) = lower(p_laboratorio) order by trabajo;
$$;

grant execute on function obtener_trabajos_mecanico(text) to authenticated;
