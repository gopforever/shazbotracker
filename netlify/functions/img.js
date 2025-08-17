/* Tiny image proxy to avoid CORS and referrer issues */
const ALLOWED_HOSTS = new Set([
  "images.pricecharting.com",
  "www.pricecharting.com",
  "sportscardspro.com",
  "www.sportscardspro.com",
  "i.ebayimg.com",
  "m.media-amazon.com",
  "image.api.playstation.com",
]);

exports.handler = async (event) => {
  try {
    const u = (event.queryStringParameters && event.queryStringParameters.u) || "";
    if (!u) return { statusCode: 400, body: "Missing u" };
    const url = new URL(u);

    // Basic allow-list
    if (!ALLOWED_HOSTS.has(url.hostname)) {
      return { statusCode: 403, body: "Host not allowed" };
    }

    const upstream = await fetch(url.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ShazbotBot/1.0)" },
    });
    if (!upstream.ok) {
      return { statusCode: upstream.status, body: `Upstream error: ${upstream.statusText}` };
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    const type = upstream.headers.get("content-type") || "image/jpeg";
    return {
      statusCode: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=604800",
      },
      body: buf.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
};
