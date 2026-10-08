-- Migración 145: el Cierre de Turno ahora calcula cuánto efectivo TIENE QUE HABER en la
-- caja: lo cobrado en efectivo, menos los pagos a profesionales y gastos pagados en
-- efectivo ese día, más/menos las transferencias de efectivo entre cajas.
--
-- Se guarda ese número en cada cierre (efectivo_esperado) para que el Cierre Diario
-- compare lo contado contra lo que realmente tenía que haber. ajuste_efectivo es la
-- parte de pagos/gastos/transferencias que ya se descontó en este cierre, para no
-- descontarla dos veces si cierran dos secretarias el mismo día.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table cierres_turno
  add column if not exists efectivo_esperado numeric,
  add column if not exists ajuste_efectivo numeric;

alter table cierres_turno_ortodoncia
  add column if not exists efectivo_esperado numeric,
  add column if not exists ajuste_efectivo numeric;
