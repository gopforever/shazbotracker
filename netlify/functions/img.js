// netlify/functions/img.js
// CommonJS Netlify Function: image proxy for SportsCardsPro product pages.
// Accepts ?id= (preferred) or ?url= (full product page).
// Extracts og:image via cheerio and streams the image back (base64).

const cheerio = require("cheerio");

async function fetchBuffer(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  const arr = await res.arrayBuffer();
  const buf = Buffer.from(arr);
  const ct = res.headers.get("content-type") || "image/jpeg";
  return { buf, ct };
}

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const id = qs.id;
    const pageUrl = qs.url || (id ? `https://www.sportscardspro.com/product/${encodeURIComponent(id)}` : null);
    if (!pageUrl) {
      return { statusCode: 400, body: "Missing id or url" };
    }

    const page = await fetch(pageUrl, { redirect: "follow" });
    if (!page.ok) {
      return { statusCode: page.status, body: `Failed to load product page (${page.status})` };
    }
    const html = await page.text();
    const $ = cheerio.load(html);

    let img = $('meta[property="og:image"]').attr("content")
          || $('meta[name="twitter:image"]').attr("content");

    if (!img) {
      const candidates = $("img").map((_, el) => $(el).attr("src")).get()
        .filter(Boolean);
      img = candidates.find(src => /(\.jpg|\.jpeg|\.png|\.webp)(\?|$)/i.test(src));
      if (img) {
        try { new URL(img); } catch {
          img = new URL(img, pageUrl).toString();
        }
      }
    }

    if (!img) {
      return { statusCode: 404, body: "Image not found" };
    }

    const { buf, ct } = await fetchBuffer(img);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, s-maxage=86400, max-age=3600"
      },
      body: buf.toString("base64"),
      isBase64Encoded: true
    };
  } catch (err) {
    return { statusCode: 500, body: `img proxy error: ${err.message}` };
  }
};
