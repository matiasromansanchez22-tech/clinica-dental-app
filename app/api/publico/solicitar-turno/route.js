import { calcularHorariosLibres, clienteServidor, contarDeLaUltimaHora, hashDeConexion, normalizarWhatsApp, textoDeDia } from "@/lib/server/consultasOnline";
import { enviarPushASuscripciones, prepararWebPush } from "@/lib/server/push";

// Pedido de turno de primera consulta hecho desde la página pública. Es una ruta abierta, así que valida todo, limita cuántos pedidos
// puede hacer una misma conexión y vuelve a comprobar en el servidor que el horario siga libre (no confía en lo que manda el navegador).
// El pedido queda "Pendiente" y reserva el horario hasta que Recepción lo agenda o lo rechaza.
export const dynamic = "force-dynamic";

const TIPOS = ["Consulta", "Control", "Continuación"];
const TEXTO_TIPO = { Consulta: "consulta", Control: "control", Continuación: "continuación" };
const MAX_PEDIDOS_POR_HORA = 4;
const MAX_PENDIENTES_POR_NUMERO = 2;

function error(mensaje, status = 400) {
  return Response.json({ ok: false, error: mensaje }, { status });
}

export async function POST(request) {
  try {
    const cuerpo = await request.json().catch(() => ({}));
    // Campo trampa para robots: una persona real nunca lo completa. Se responde "ok" sin guardar nada.
    if (cuerpo.sitioWeb) return Response.json({ ok: true });

    const nombre = String(cuerpo.nombre || "").replace(/\s+/g, " ").trim();
    if (nombre.length < 2 || nombre.length > 80) return error("Escribí tu nombre completo.");
    const whatsapp = normalizarWhatsApp(cuerpo.whatsapp);
    if (!whatsapp) return error("Revisá el número de WhatsApp: tiene que ser un celular con código de área, por ejemplo 341 555 1234.");
    const fecha = String(cuerpo.fecha || "");
    const hora = String(cuerpo.hora || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return error("Elegí un día y un horario.");
    if (cuerpo.acepta !== true) return error("Para pedir el turno tenés que aceptar que te contactemos por WhatsApp.");
    const lugar = /^[a-z0-9-]{1,40}$/.test(String(cuerpo.lugar || "")) ? String(cuerpo.lugar) : null;
    // Tipo de turno (consulta nueva, control o continuación) y documento. En controles y continuaciones el documento es obligatorio:
    // es lo que le permite a Recepción encontrar la ficha.
    const tipo = TIPOS.includes(cuerpo.tipo) ? cuerpo.tipo : "Consulta";
    const dni = String(cuerpo.dni || "").replace(/\D/g, "");
    if (dni && (dni.length < 6 || dni.length > 9)) return error("Revisá el número de documento: tiene que tener entre 6 y 9 números, sin puntos.");
    if (tipo !== "Consulta" && !dni) return error("Escribí tu número de documento para que encontremos tu ficha.");

    const supabase = clienteServidor();
    const ipHash = hashDeConexion(request);
    if ((await contarDeLaUltimaHora(supabase, "solicitudes_turno_ortodoncia", ipHash)) >= MAX_PEDIDOS_POR_HORA) {
      return error("Hiciste varios pedidos seguidos. Escribinos por WhatsApp y lo coordinamos.", 429);
    }
    const { count: pendientesDelNumero } = await supabase
      .from("solicitudes_turno_ortodoncia")
      .select("id", { count: "exact", head: true })
      .eq("whatsapp", whatsapp)
      .eq("estado", "Pendiente");
    if ((pendientesDelNumero || 0) >= MAX_PENDIENTES_POR_NUMERO) {
      return error("Ya tenés pedidos de turno en espera con ese número. Te vamos a escribir por WhatsApp para confirmarlos.", 429);
    }

    // El horario se vuelve a calcular acá: tiene que seguir libre, y de ahí sale quién atiende y el consultorio.
    const libres = await calcularHorariosLibres(supabase, { soloFecha: fecha });
    const slot = libres.dias[0]?.slots.find((s) => s.hora === hora);
    if (!slot) return error("Ese horario ya no está disponible. Elegí otro, por favor.", 409);

    const fila = { nombre, whatsapp, fecha, hora_inicio: hora, duracion_min: libres.duracionMin, profesional_id: slot.profesionalId, consultorio: slot.consultorio, lugar, ip_hash: ipHash };
    const insertar = (datos) => supabase.from("solicitudes_turno_ortodoncia").insert(datos).select("id, created_at").single();
    let { data: creada, error: errorInsert } = await insertar({ ...fila, tipo, dni: dni || null });
    // Si todavía no se corrió la migración 203 (faltan las columnas tipo y dni), el pedido se guarda igual, sin esos dos datos.
    if (errorInsert && /tipo|dni|column|schema cache/i.test(errorInsert.message || "")) ({ data: creada, error: errorInsert } = await insertar(fila));
    if (errorInsert) throw errorInsert;

    // Si dos personas pidieron el mismo horario casi a la vez, se queda la primera.
    const { data: mismos } = await supabase
      .from("solicitudes_turno_ortodoncia")
      .select("id, created_at")
      .eq("estado", "Pendiente")
      .eq("fecha", fecha)
      .eq("hora_inicio", hora)
      .eq("profesional_id", slot.profesionalId)
      .order("created_at", { ascending: true });
    if (mismos?.length > 1 && mismos[0].id !== creada.id) {
      await supabase.from("solicitudes_turno_ortodoncia").delete().eq("id", creada.id);
      return error("Ese horario se acaba de reservar. Elegí otro, por favor.", 409);
    }

    // Aviso a Recepción y a las Dueñas. Si falla, el pedido igual quedó guardado.
    try {
      if (prepararWebPush()) {
        const { data: subs } = await supabase.from("push_subscriptions").select("*, usuario:perfiles(rol)");
        const destinatarios = (subs || []).filter((s) => ["Secretaria", "Duena"].includes(s.usuario?.rol));
        await enviarPushASuscripciones(supabase, destinatarios, {
          title: `🦷 Nuevo pedido de ${TEXTO_TIPO[tipo]} de ortodoncia`,
          body: `${nombre} pidió turno el ${textoDeDia(fecha)} a las ${hora}. Hay que escribirle por WhatsApp para confirmar.`,
          url: "/ortodoncia/consultas-online",
          persistente: true,
          tag: "pedido-turno-online",
        });
      }
    } catch {
      // sin aviso, nada más
    }

    return Response.json({ ok: true, fecha, hora, texto: `${textoDeDia(fecha)} a las ${hora}` });
  } catch (e) {
    return Response.json({ ok: false, error: "No pudimos registrar tu pedido. Probá de nuevo o escribinos por WhatsApp.", ...(process.env.NODE_ENV !== "production" ? { detalle: String(e?.message || e) } : {}) }, { status: 200 });
  }
}
