-- Migración 171: el profesional indica cómo va a pagar el paciente (Odontología General).
--
-- Al marcar lo que hizo y enviarlo a caja, el profesional elige si el paciente paga en efectivo o por transferencia, y si lo hace al
-- contado o en 2 veces. La secretaria lo ve al cobrar (aviso de "listo para cobrar" y formulario de cobro), así no se cobra el precio
-- equivocado. El precio de efectivo y el de lista (transferencia) del catálogo son distintos.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table prestaciones_realizadas_agenda
  add column if not exists forma_pago_prevista text check (forma_pago_prevista in ('Efectivo', 'Transferencia')),
  add column if not exists cuotas_previstas smallint check (cuotas_previstas in (1, 2));
