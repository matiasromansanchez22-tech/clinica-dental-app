-- Migración 155: el monto del aumento de Ortodoncia queda protegido en la base.
--
-- Hasta ahora, cuando a un paciente le tocaba el aumento, la pantalla de cobro les fijaba el
-- monto a las secretarias, pero era solo un bloqueo visual: alguien con conocimientos técnicos
-- podía saltearlo y guardar un cobro de Control más barato directo en la base.
--
-- Con esta migración, la base rechaza el guardado de un cobro de Control hecho por una
-- Secretaria si el paciente tiene el aumento vencido (próximo aumento anterior a la fecha del
-- cobro) y el importe es menor a la cuota con aumento × controles abonados.
-- · El saldo a favor del paciente se descuenta de ese mínimo (porque el cobro puede salir más
--   barato al aplicarlo).
-- · Cobrar MÁS que ese mínimo se permite (cargo extra, reposición de brackets).
-- · Las Dueñas no tienen esta restricción (descuentos autorizados).
-- · Los cobros viejos no se tocan: solo se controla al crear un cobro o al cambiarle el importe,
--   el concepto, la cantidad de controles, el paciente o la fecha.
--
-- Para DESHACER: drop trigger if exists bloqueo_aumento_ortodoncia on caja_ortodoncia;
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create or replace function validar_aumento_ortodoncia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valor_control numeric;
  v_proximo_aumento date;
  v_porcentaje numeric;
  v_cuota_nueva numeric;
  v_saldo numeric;
  v_minimo numeric;
begin
  -- Solo controla lo que carga una persona logueada que no es Dueña.
  if auth.uid() is null or es_duena() then
    return new;
  end if;
  if new.concepto <> 'Control' or new.paciente_id is null then
    return new;
  end if;

  select valor_control, proximo_aumento
    into v_valor_control, v_proximo_aumento
    from pacientes_ortodoncia
   where id = new.paciente_id;

  if v_valor_control is null or v_valor_control <= 0
     or v_proximo_aumento is null or v_proximo_aumento >= new.fecha then
    return new;
  end if;

  select coalesce((select valor from configuracion_ortodoncia where clave = 'aumento_porcentaje'), 25)
    into v_porcentaje;

  -- Misma cuenta que la pantalla: valor × (1 + %), redondeado a la centena.
  v_cuota_nueva := round(v_valor_control * (1 + v_porcentaje / 100) / 100) * 100;

  select coalesce(sum(monto), 0)
    into v_saldo
    from saldos_a_favor
   where paciente_ortodoncia_id = new.paciente_id;

  v_minimo := v_cuota_nueva * coalesce(new.cantidad_controles_abonados, 1) - greatest(v_saldo, 0);

  if new.importe < v_minimo - 1 then
    raise exception 'Este paciente tiene aumento: el Control no puede cobrarse por menos de $% (cuota con aumento $%). Si hay un descuento autorizado, lo carga una dueña.',
      to_char(round(v_minimo), 'FM999G999G999'), to_char(v_cuota_nueva, 'FM999G999G999')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists bloqueo_aumento_ortodoncia on caja_ortodoncia;
create trigger bloqueo_aumento_ortodoncia
  before insert or update of importe, concepto, cantidad_controles_abonados, paciente_id, fecha
  on caja_ortodoncia
  for each row execute function validar_aumento_ortodoncia();
