// netlify/functions/img.js
const ALLOW = [
  "storage.googleapis.com",
  "sportscardspro.com", "images.sportscardspro.com", "img.sportscardspro.com",
  "pricecharting.com", "images.pricecharting.com", "img.pricecharting.com"
];
exports.handler = async (event) => {
  try {
    const raw = (event.queryStringParameters || {}).url || (event.queryStringParameters || {}).src || "";
    if (!raw) return { statusCode: 400, body: "Missing url/src" };
    let u; try { u = new URL(raw); } catch { return { statusCode: 400, body: "Bad URL" }; }
    const ok = ALLOW.some(host => u.hostname === host || u.hostname.endsWith("." + host));
    if (!ok) return { statusCode: 403, body: "Host not allowed" };
    const r = await fetch(u.toString());
    const buf = await r.arrayBuffer();
    const ct = r.headers.get("content-type") || "image/jpeg";
    return {
      statusCode: 200,
      headers: { "content-type": ct, "cache-control": "public, max-age=31536000, immutable", "access-control-allow-origin": "*" },
      body: Buffer.from(buf).toString("base64"),
      isBase64Encoded: true
    };
  } catch (e) { return { statusCode: 500, body: String(e) }; }
};
