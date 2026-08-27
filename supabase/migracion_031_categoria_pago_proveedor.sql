-- Migración 031: agrega la categoría "Pago a proveedor" a Gastos, para que
-- los pagos chicos que se registran desde Caja (a un proveedor que viene a
-- cobrar en el momento, por ejemplo) se puedan clasificar aparte de "Otro".
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

insert into categorias_gasto (nombre) values ('Pago a proveedor')
on conflict (nombre) do nothing;
