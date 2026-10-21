-- Migración 167: la contadora puede volver a cargar pagos con la reserva (por ejemplo cuando una Dueña no está).
--
-- La migración 166 le forzaba desde_reserva = false a todo lo que cargaba la Contadora. Eso se saca: ahora la casilla "Se paga con
-- la reserva" no se le tilda sola (hay que elegirla a propósito y confirmarla) y cada pago que cargue con la reserva le aparece a
-- la Dueña en "Qué revisar" para confirmarlo. Se mantiene la tabla de revisiones de la migración 166.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

drop trigger if exists gastos_contador_sin_reserva on gastos;
drop trigger if exists pagos_profesionales_contador_sin_reserva on pagos_profesionales;
drop function if exists forzar_sin_reserva_si_es_contador();
