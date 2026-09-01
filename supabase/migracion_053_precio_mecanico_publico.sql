-- Migración 053: dos funciones para que cualquier usuario logueado
-- (no solo la Dueña) pueda auto-completar el valor y el nombre del
-- laboratorio al cargar un trabajo, SIN darle acceso de lectura a la
-- tabla completa mecanicos_precios (que sigue siendo Dueña-only: precios
-- de todos los mecánicos, contactos, observaciones, cuál está descartado,
-- etc. siguen siendo privados).
--
-- obtener_precio_mecanico: dado un laboratorio + tipo de trabajo exactos,
-- devuelve solo ese precio puntual (o nada si no hay coincidencia) — no
-- se puede usar para "pasear" la tabla.
-- obtener_laboratorios_mecanicos: devuelve solo los nombres de laboratorio
-- (sin precios ni contactos), para sugerir mientras se escribe.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create or replace function obtener_precio_mecanico(p_laboratorio text, p_trabajo text)
returns numeric
language sql
security definer
set search_path = public
as $$
  select precio
  from mecanicos_precios
  where lower(laboratorio) = lower(p_laboratorio)
    and lower(trabajo) = lower(p_trabajo)
  limit 1;
$$;

grant execute on function obtener_precio_mecanico(text, text) to authenticated;

create or replace function obtener_laboratorios_mecanicos()
returns table (laboratorio text)
language sql
security definer
set search_path = public
as $$
  select distinct laboratorio from mecanicos_precios order by laboratorio;
$$;

grant execute on function obtener_laboratorios_mecanicos() to authenticated;
