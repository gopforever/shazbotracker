// netlify/functions/scp.js
function json(status, obj) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=60"
    },
    body: JSON.stringify(obj)
  };
}
function slugify(s) {
  if (!s) return "";
  return s.toLowerCase().normalize("NFKD").replace(/[’']/g, "").replace(/&/g, " and ").replace(/\[[^\]]*\]/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function parseProductName(nameRaw) {
  const m = /^(.*?)\s*(?:\[(.*?)\])?\s*#(\d+)/i.exec(nameRaw || "");
  if (!m) return { base: slugify(nameRaw || ""), variant: "", num: "" };
  return { base: slugify(m[1]||""), variant: slugify(m[2]||""), num: (m[3]||"") };
}
function buildPageUrl(consoleName, productName) {
  const cat = slugify(consoleName || ""); const { base, variant, num } = parseProductName(productName || "");
  const prod = [base, variant, num].filter(Boolean).join("-");
  return `https://www.sportscardspro.com/game/${cat}/${prod}`;
}
const cache = new Map();
async function findMainImage(pageUrl) {
  if (!pageUrl) return null;
  if (cache.has(pageUrl)) return cache.get(pageUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const r = await fetch(pageUrl, { headers: { "user-agent": "Mozilla/5.0 Shazbot/1.0" }, signal: controller.signal });
    const html = await r.text();
    const m = html.match(/https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[a-z0-9]+\/\d+\.jpg/i);
    let url = m ? m[0] : null;
    if (url) url = url.replace(/\/\d+\.jpg$/, "/400.jpg");
    cache.set(pageUrl, url);
    return url;
  } catch (_) { return null; } finally { clearTimeout(timer); }
}
exports.handler = async (event) => {
  const token = process.env.SCP_TOKEN;
  if (!token) return json(500, { status: "error", "error-message": "Missing SCP_TOKEN env var" });
  const p = event.queryStringParameters || {};
  const base = "https://www.sportscardspro.com"; const path = p.path || "/api/products";
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(p)) { if (["path","withImage","imageLimit"].includes(k)) continue; url.searchParams.set(k, v); }
  url.searchParams.set("t", token); url.searchParams.set("token", token);
  const withImage = p.withImage === "1" || p.withImage === "true"; const imageLimit = Math.max(0, Math.min(50, parseInt(p.imageLimit || "12")));
  try {
    const r = await fetch(url.toString(), { headers: { "accept": "application/json" } });
    const text = await r.text(); let data;
    try { data = JSON.parse(text); } catch (e) { return json(r.status || 502, { status: "error", "error-message": text }); }
    if (!withImage) return json(200, data);
    if (path === "/api/product" && data && typeof data === "object") {
      const pageUrl = buildPageUrl(data["console-name"], data["product-name"]); const thumb = await findMainImage(pageUrl);
      if (pageUrl) data.pageUrl = pageUrl; if (thumb) { data.thumb = thumb; data["image-url"] = thumb; } return json(200, data);
    }
    if (Array.isArray(data.products)) {
      const items = data.products.slice(0, imageLimit); let i = 0, concurrency = 5;
      async function worker() { while (i < items.length) { const idx = i++; const row = items[idx];
        try { const pageUrl = buildPageUrl(row["console-name"], row["product-name"]); const thumb = await findMainImage(pageUrl);
          if (pageUrl) row.pageUrl = pageUrl; if (thumb) { row.thumb = thumb; row["image-url"] = thumb; } } catch {}
      } }
      await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker)); return json(200, data);
    }
    return json(200, data);
  } catch (err) { return json(502, { status: "error", "error-message": String(err) }); }
};
