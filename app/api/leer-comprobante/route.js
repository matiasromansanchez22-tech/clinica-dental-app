import Anthropic from "@anthropic-ai/sdk";

const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR"];

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Falta configurar ANTHROPIC_API_KEY en el servidor. Avisale a Claude para que la conecte." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const archivo = formData.get("archivo");
    const categoriasRaw = formData.get("categorias");
    if (!archivo) {
      return Response.json({ error: "Falta el archivo." }, { status: 400 });
    }

    let categorias = [];
    try {
      categorias = JSON.parse(categoriasRaw || "[]");
    } catch {
      categorias = [];
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const base64 = buffer.toString("base64");
    const tipo = archivo.type || "";

    let contenidoArchivo;
    if (TIPOS_IMAGEN.includes(tipo)) {
      contenidoArchivo = { type: "image", source: { type: "base64", media_type: tipo, data: base64 } };
    } else if (tipo === "application/pdf") {
      contenidoArchivo = { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };
    } else {
      return Response.json(
        { error: "Formato no soportado — subí una foto (jpg, png) o un PDF." },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    const prompt = `Esto es un comprobante de pago o una factura de una clínica dental en Argentina. Mirá la imagen/documento y devolveme SOLO un JSON (sin texto antes ni después, sin \`\`\`) con esta forma exacta:

{
  "monto": <número, el importe total en pesos argentinos, sin puntos de miles ni el símbolo $, o null si no se ve>,
  "fecha": <fecha en formato "YYYY-MM-DD" si aparece en el comprobante, o null>,
  "medioPago": <uno de estos exactamente si se puede inferir, si no null: ${JSON.stringify(MEDIOS_PAGO)}>,
  "categoriaSugerida": <la que mejor calce de esta lista, exactamente como está escrita, o null si ninguna calza bien: ${JSON.stringify(categorias)}>,
  "descripcion": <una descripción corta de una línea de qué es (ej. "Alquiler septiembre", "Factura Dental Pin"), o "" si no queda claro>
}

Si es un comprobante de transferencia o Mercado Pago, "monto" es lo que se transfirió. Si es una factura con varios ítems, "monto" es el total final. No inventes datos que no se ven — usá null si no estás seguro.`;

    const respuesta = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [contenidoArchivo, { type: "text", text: prompt }],
        },
      ],
    });

    const textoCrudo = respuesta.content.find((b) => b.type === "text")?.text || "{}";
    // Por si igual viene envuelto en ```json ... ``` a pesar de haberlo pedido sin eso.
    const textoLimpio = textoCrudo.replace(/```json|```/g, "").trim();

    let datos;
    try {
      datos = JSON.parse(textoLimpio);
    } catch {
      return Response.json(
        { error: "La IA no devolvió un resultado que se pueda leer. Probá de nuevo o cargalo a mano." },
        { status: 422 }
      );
    }

    return Response.json({
      monto: typeof datos.monto === "number" ? datos.monto : null,
      fecha: datos.fecha || null,
      medioPago: MEDIOS_PAGO.includes(datos.medioPago) ? datos.medioPago : null,
      categoriaSugerida: categorias.includes(datos.categoriaSugerida) ? datos.categoriaSugerida : null,
      descripcion: datos.descripcion || "",
    });
  } catch (err) {
    return Response.json({ error: err.message || "Error al leer el comprobante." }, { status: 500 });
  }
}
