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
    if (!archivo) {
      return Response.json({ error: "Falta el archivo." }, { status: 400 });
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

    const prompt = `Esto es una factura o remito de un proveedor de insumos dentales en Argentina. Mirá la imagen/documento y devolveme SOLO un JSON (sin texto antes ni después, sin \`\`\`) con esta forma exacta:

{
  "proveedor": <nombre del proveedor/empresa que emite la factura, o null si no se ve>,
  "fecha": <fecha de la factura en formato "YYYY-MM-DD", o null si no se ve>,
  "medioPago": <uno de estos exactamente si se puede inferir, si no null: ${JSON.stringify(MEDIOS_PAGO)}>,
  "items": [
    { "nombre": <nombre del insumo tal como aparece en la factura>, "cantidad": <número>, "precioUnitario": <número, precio unitario en pesos argentinos sin puntos de miles ni símbolo $> }
  ],
  "observaciones": <número de factura o algo corto que ayude a identificarla, o "" si no hay nada relevante>
}

Cargá TODOS los ítems que aparecen en la factura, uno por línea. Si un ítem no tiene precio unitario pero sí un subtotal y una cantidad, calculá el precio unitario dividiendo. No inventes datos que no se ven — usá null (o 0 en cantidad/precio) si no estás seguro.`;

    const respuesta = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [contenidoArchivo, { type: "text", text: prompt }],
        },
      ],
    });

    const textoCrudo = respuesta.content.find((b) => b.type === "text")?.text || "{}";
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

    const items = Array.isArray(datos.items)
      ? datos.items
          .filter((i) => i && i.nombre)
          .map((i) => ({
            nombre: String(i.nombre),
            cantidad: Number(i.cantidad) || 0,
            precioUnitario: Number(i.precioUnitario) || 0,
          }))
      : [];

    return Response.json({
      proveedor: datos.proveedor || null,
      fecha: datos.fecha || null,
      medioPago: MEDIOS_PAGO.includes(datos.medioPago) ? datos.medioPago : null,
      items,
      observaciones: datos.observaciones || "",
    });
  } catch (err) {
    return Response.json({ error: err.message || "Error al leer la factura." }, { status: 500 });
  }
}
