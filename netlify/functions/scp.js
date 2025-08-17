// netlify/functions/scp.js
// CommonJS Netlify Function: SportsCardsPro search via PriceCharting API
// Filters to sports sets and returns a thumbnail proxy URL per item.
//
// Env: SCP_TOKEN (your SportscardsPro/PriceCharting API token)
//
// Test:
//   /.netlify/functions/scp?q=2025%20score%20rookie&withImage=1
//   /.netlify/functions/scp?q=michael%20penix%20jr&withImage=1

const allowedStarts = [
  "Football Cards","Basketball Cards","Baseball Cards","Hockey Cards",
  "Soccer Cards","Racing Cards","Wrestling Cards","UFC","UFC Cards",
  "Golf Cards","Tennis Cards","Boxing Cards"
];

exports.handler = async (event) => {
  try {
    const token = process.env.SCP_TOKEN;
    if (!token) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing SCP_TOKEN" }) };
    }

    const qs = event.queryStringParameters || {};
    const q = (qs.q || "").trim();
    const withImage = (qs.withImage || "1").toString().toLowerCase();
    const limit = Math.max(1, Math.min(parseInt(qs.limit || "150", 10) || 150, 300));

    if (!q) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ products: [] })
      };
    }

    const url = `https://www.pricecharting.com/api/products?t=${encodeURIComponent(token)}&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        statusCode: res.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: `Upstream ${res.status}`, detail: text })
      };
    }
    const data = await res.json();
    const products = Array.isArray(data?.products) ? data.products : [];

    // Filter to sports sets only using console-name prefix
    const sports = products.filter(p => {
      const name = (p["console-name"] || "").toString();
      return allowedStarts.some(prefix => name.startsWith(prefix));
    });

    // Add thumbnail proxy + product page
    const includeImages = withImage === "1" || withImage === "true";
    const enriched = sports.slice(0, limit).map(p => {
      const id = p.id || p.product?.id;
      return {
        ...p,
        productUrl: id ? `https://www.sportscardspro.com/product/${id}` : undefined,
        thumb: includeImages && id ? `/.netlify/functions/img?id=${encodeURIComponent(id)}` : null
      };
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ products: enriched, total: enriched.length })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message || "proxy error" })
    };
  }
};
