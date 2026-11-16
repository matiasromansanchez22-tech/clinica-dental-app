import {
  calcularHorariosLibresGeneral,
  clienteServidor,
  contarDeLaUltimaHora,
  elegirOpcion,
  hashDeConexion,
  normalizarWhatsApp,
  obtenerMotivosGeneral,
  textoDeDia,
} from "@/lib/server/consultasOnline";
import { enviarPushASuscripciones, prepararWebPush } from "@/lib/server/push";

// Pedido de turno de Odontología General hecho desde la página pública. Igual que el de ortodoncia: ruta abierta, así que valida todo,
// limita pedidos por conexión, vuelve a comprobar en el servidor que el horario siga libre y reserva el lugar hasta que Recepción
// lo agenda o lo da de baja. El profesional lo asigna el servidor entre los que atienden ese motivo.
export const dynamic = "force-dynamic";

const MAX_PEDIDOS_POR_HORA = 4;
const MAX_PENDIENTES_POR_NUMERO = 2;

function error(mensaje, status = 400) {
  return Response.json({ ok: false, error: mensaje }, { status });
}

export async function POST(request) {
  try {
    const cuerpo = await request.json().catch(() => ({}));
    if (cuerpo.sitioWeb) return Response.json({ ok: true }); // campo trampa para robots

    const nombre = String(cuerpo.nombre || "").replace(/\s+/g, " ").trim();
    if (nombre.length < 2 || nombre.length > 80) return error("Escribí tu nombre completo.");
    const whatsapp = normalizarWhatsApp(cuerpo.whatsapp);
    if (!whatsapp) return error("Revisá el número de WhatsApp: tiene que ser un celular con código de área, por ejemplo 341 555 1234.");
    const esPaciente = cuerpo.esPaciente === true;
    const dni = String(cuerpo.dni || "").replace(/\D/g, "");
    if (dni && (dni.length < 6 || dni.length > 9)) return error("Revisá el número de documento: tiene que tener entre 6 y 9 números, sin puntos.");
    if (esPaciente && !dni) return error("Escribí tu número de documento para que encontremos tu ficha.");
    const obraSocial = String(cuerpo.obraSocial || "").replace(/\s+/g, " ").trim().slice(0, 60) || null;
    const fecha = String(cuerpo.fecha || "");
    const hora = String(cuerpo.hora || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return error("Elegí un día y un horario.");
    if (cuerpo.acepta !== true) return error("Para pedir el turno tenés que aceptar que te contactemos por WhatsApp.");
    const lugar = /^[a-z0-9-]{1,40}$/.test(String(cuerpo.lugar || "")) ? String(cuerpo.lugar) : null;
    const claveMotivo = String(cuerpo.motivo || "");

    const supabase = clienteServidor();
    const motivo = (await obtenerMotivosGeneral(supabase)).find((m) => m.clave === claveMotivo);
    if (!motivo || motivo.accion !== "turno") return error("Elegí para qué es la consulta.");

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
    const libres = await calcularHorariosLibresGeneral(supabase, motivo, { soloFecha: fecha });
    const dia = libres.dias[0];
    const slot = dia?.slots.find((s) => s.hora === hora);
    if (!slot) return error("Ese horario ya no está disponible. Elegí otro, por favor.", 409);
    const opcion = elegirOpcion(slot, dia.carga);

    const base = {
      area: "General",
      motivo: motivo.nombre,
      obra_social: obraSocial,
      nombre,
      whatsapp,
      fecha,
      hora_inicio: hora,
      duracion_min: libres.duracionMin,
      profesional_id: opcion.profesionalId,
      consultorio: opcion.consultorio,
      lugar,
      ip_hash: ipHash,
    };
    const insertar = (datos) => supabase.from("solicitudes_turno_ortodoncia").insert(datos).select("id, created_at").single();
    // "tipo" (Control = ya es paciente) y "dni" vienen de la migración 203. Si todavía no se corrió, el pedido se guarda igual y esos
    // datos van en la nota, para que Recepción los vea y el panel los lea de ahí.
    let { data: creada, error: errorInsert } = await insertar({ ...base, tipo: esPaciente ? "Control" : "Consulta", dni: dni || null });
    if (errorInsert && /'tipo'|'dni'/.test(errorInsert.message || "")) {
      const nota = [esPaciente ? "Ya es paciente" : null, dni ? `DNI ${dni}` : null].filter(Boolean).join(" · ") || null;
      ({ data: creada, error: errorInsert } = await insertar({ ...base, nota }));
    }
    if (errorInsert) {
      if (/area|motivo|obra_social|column|schema cache/i.test(errorInsert.message || "")) {
        return error("La página de turnos todavía no está lista. Escribinos por WhatsApp y te damos turno.", 503);
      }
      throw errorInsert;
    }

    // Si dos personas pidieron el mismo horario casi a la vez con el mismo profesional, se queda la primera.
    const { data: mismos } = await supabase
      .from("solicitudes_turno_ortodoncia")
      .select("id, created_at")
      .eq("estado", "Pendiente")
      .eq("fecha", fecha)
      .eq("hora_inicio", hora)
      .eq("profesional_id", opcion.profesionalId)
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
          title: "🦷 Nuevo pedido de turno de Odontología General",
          body: `${nombre} · ${motivo.nombre} · ${textoDeDia(fecha)} a las ${hora}. Hay que escribirle por WhatsApp para confirmar.`,
          url: "/ortodoncia/consultas-online",
          persistente: true,
          tag: "pedido-turno-online",
        });
      }
    } catch {
      // sin aviso, nada más
    }

    return Response.json({ ok: true, fecha, hora, con: opcion.nombre, texto: `${textoDeDia(fecha)} a las ${hora}` });
  } catch (e) {
    return Response.json({ ok: false, error: "No pudimos registrar tu pedido. Probá de nuevo o escribinos por WhatsApp.", ...(process.env.NODE_ENV !== "production" ? { detalle: String(e?.message || e) } : {}) }, { status: 200 });
  }
}
