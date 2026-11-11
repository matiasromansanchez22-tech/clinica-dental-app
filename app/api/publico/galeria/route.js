import { clienteServidor } from "@/lib/server/consultasOnline";

// Casos (fotos de antes y después) que se muestran en la página pública. Devuelve SOLO los casos publicados, con la autorización del
// paciente tildada y las dos fotos; nunca nombres ni datos de pacientes. Si la tabla todavía no existe, devuelve una lista vacía.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = clienteServidor();
    const { data, error } = await supabase
      .from("galeria_casos")
      .select("id, titulo, descripcion, tratamiento, duracion_meses, foto_antes, foto_despues")
      .eq("publicado", true)
      .eq("consentimiento", true)
      .not("foto_antes", "is", null)
      .not("foto_despues", "is", null)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return Response.json({ ok: true, casos: [] });
    const url = (ruta) => supabase.storage.from("galeria").getPublicUrl(ruta).data.publicUrl;
    const casos = data.map((c) => ({
      id: c.id,
      titulo: c.titulo,
      descripcion: c.descripcion,
      tratamiento: c.tratamiento,
      duracionMeses: c.duracion_meses,
      antes: url(c.foto_antes),
      despues: url(c.foto_despues),
    }));
    return Response.json({ ok: true, casos }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } });
  } catch {
    return Response.json({ ok: true, casos: [] });
  }
}
