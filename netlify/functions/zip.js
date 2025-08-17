// netlify/functions/zip.js
import JSZip from "jszip";

export default async (request, context) => {
  try {
    const body = await request.json(); // { files: [{name, content(base64 or text), type}], images:[{name, url}] }
    const zip = new JSZip();

    // Add files (CSV, JSON, etc.)
    for (const f of (body.files || [])) {
      if (f.base64) {
        zip.file(f.name, Buffer.from(f.base64, "base64"));
      } else if (typeof f.content === "string") {
        zip.file(f.name, f.content);
      }
    }

    // Fetch and add images
    for (const img of (body.images || [])) {
      try {
        const r = await fetch(img.url);
        if (r.ok) {
          const buf = Buffer.from(await r.arrayBuffer());
          zip.file(img.name || "image.jpg", buf);
        }
      } catch {}
    }

    const buf = await zip.generateAsync({ type: "nodebuffer" });
    return new Response(buf, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": 'attachment; filename="export.zip"',
        "cache-control": "no-store"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "zip error" }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
};
