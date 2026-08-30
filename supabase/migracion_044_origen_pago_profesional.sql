-- Migración 044: distingue si un pago a profesional se cargó desde Caja
-- (mismo día, con la plata que entró hoy) o desde Producción y liquidación
-- (puede ser un pago diferido, con plata que ya no está en el cajón).
--
-- Esto es necesario para que el "Disponible" de Caja SOLO reste los pagos
-- que realmente salieron de esa caja ese día, y no los pagos diferidos que
-- casualmente tienen la misma fecha pero son de otra plata.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table pagos_profesionales add column if not exists origen text not null default 'Produccion'
  check (origen in ('Caja', 'Produccion'));
