-- Migración 195: "recordar como gasto fijo" en Planificar pagos.
--
-- Si se tilda al agregar un pago, al registrarlo queda guardado en Gastos de la Clínica con ese monto, y el mes que viene
-- aparece solo en la lista. Los gastos fijos que ya existen (alquiler, internet, etc.) actualizan su monto solos cada vez.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table pagos_planificados add column if not exists recordar boolean not null default false;
