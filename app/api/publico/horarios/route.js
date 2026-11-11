import { calcularHorariosLibres, clienteServidor } from "@/lib/server/consultasOnline";

// Horarios libres para pedir una primera consulta de ortodoncia (los ve cualquiera, sin iniciar sesión). Devuelve solo días y horas:
// nunca quién atiende ni en qué consultorio, ni datos de otros pacientes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await calcularHorariosLibres(clienteServidor());
    return Response.json(
      { ok: true, configurado: r.configurado, duracionMin: r.duracionMin, dias: r.dias.map((d) => ({ fecha: d.fecha, horas: d.slots.map((s) => s.hora) })) },
      { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40" } }
    );
  } catch (e) {
    return Response.json({ ok: false, ...(process.env.NODE_ENV !== "production" ? { detalle: String(e?.message || e) } : {}) }, { status: 200 });
  }
}
