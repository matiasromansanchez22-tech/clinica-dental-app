import { parsearFacturacionAsorPdf } from "@/lib/pdf/parsearFacturacionAsor";
import { usuarioValido } from "@/lib/server/verificarSesion";

export async function POST(request) {
  try {
    if (!(await usuarioValido(request))) {
      return Response.json({ error: "No autorizado." }, { status: 401 });
    }

    const formData = await request.formData();
    const archivo = formData.get("archivo");
    if (!archivo) {
      return Response.json({ error: "Falta el archivo PDF." }, { status: 400 });
    }

    const buffer = await archivo.arrayBuffer();
    const lineas = await parsearFacturacionAsorPdf(buffer);

    if (lineas.length === 0) {
      return Response.json(
        { error: "No se pudo leer ninguna fila de este PDF. Puede que el formato sea distinto al esperado." },
        { status: 422 }
      );
    }

    return Response.json({ lineas });
  } catch (err) {
    return Response.json({ error: err.message || "Error al leer el PDF." }, { status: 500 });
  }
}
