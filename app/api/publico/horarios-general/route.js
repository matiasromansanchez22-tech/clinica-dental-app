import { calcularHorariosLibresGeneral, clienteServidor, obtenerMotivosGeneral } from "@/lib/server/consultasOnline";

// Días y horarios libres para pedir turno de Odontología General según el motivo elegido (los ve cualquiera, sin iniciar sesión).
// Devuelve solo días, horas y el nombre de pila de quién atiende: nunca consultorios ni datos de otros pacientes.
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const clave = new URL(request.url).searchParams.get("motivo") || "";
    if (!/^[a-z0-9-]{1,40}$/.test(clave)) return Response.json({ ok: false, error: "Elegí un motivo." }, { status: 400 });
    const supabase = clienteServidor();
    const motivo = (await obtenerMotivosGeneral(supabase)).find((m) => m.clave === clave);
    if (!motivo || motivo.accion !== "turno") return Response.json({ ok: false, error: "Ese motivo no se pide por acá." }, { status: 400 });
    const r = await calcularHorariosLibresGeneral(supabase, motivo);
    return Response.json(
      {
        ok: true,
        duracionMin: r.duracionMin,
        dias: r.dias.map((d) => ({ fecha: d.fecha, horas: d.slots.map((s) => ({ hora: s.hora, con: [...new Set(s.opciones.map((o) => o.nombre))] })) })),
      },
      { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40" } }
    );
  } catch (e) {
    return Response.json({ ok: false, ...(process.env.NODE_ENV !== "production" ? { detalle: String(e?.message || e) } : {}) }, { status: 200 });
  }
}
