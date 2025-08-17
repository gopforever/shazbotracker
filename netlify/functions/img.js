// netlify/functions/img.js
// Simple image proxy with Web API style
export default async (request, context) => {
  const { searchParams } = new URL(request.url);
  const src = searchParams.get("src");
  if (!src) return new Response("Missing src", { status: 400 });
  try {
    const r = await fetch(src, { redirect: "follow" });
    if (!r.ok) return new Response("Upstream error", { status: r.status });
    // Pass through content-type
    const ct = r.headers.get("content-type") || "image/jpeg";
    const buf = await r.arrayBuffer();
    return new Response(buf, { status: 200, headers: {
      "content-type": ct,
      "cache-control": "public, max-age=86400"
    }});
  } catch (e) {
    return new Response("proxy error", { status: 502 });
  }
};
