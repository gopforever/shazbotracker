
// netlify/functions/scp.js
// Server-side proxy for PriceCharting/SportsCardsPro search & product detail.
// Keeps API token off the client and optionally enriches with image_url.
const fetchImpl = global.fetch; // Node 18+ has global fetch

function cors(json, status=200, extraHeaders={}){
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'public, max-age=300',
      ...extraHeaders
    },
    body: JSON.stringify(json)
  };
}

exports.handler = async (event) => {
  try {
    const token = process.env.SCP_TOKEN || "";
    if (!token) {
      return cors({ error: 'Missing server token (SCP_TOKEN not set)' }, 500);
    }
    const u = new URL(event.rawUrl || `http://x.local${event.path}${event.rawQuery ? '?'+event.rawQuery : ''}`);
    const q = u.searchParams.get('q');
    const id = u.searchParams.get('id');
    const withImage = u.searchParams.get('withImage') === '1' || u.searchParams.get('withImage') === 'true';
    const limit = Math.min(100, parseInt(u.searchParams.get('limit')||'50',10));

    if (id) {
      // Product detail endpoint
      const url = `https://www.pricecharting.com/api/product?t=${encodeURIComponent(token)}&id=${encodeURIComponent(id)}`;
      const r = await fetchImpl(url);
      if (!r.ok) return cors({ error: `Upstream ${r.status}` }, r.status);
      const prod = await r.json();
      // Normalize to include .image (if present)
      if (prod && !prod.image && prod.image_url) prod.image = prod.image_url;
      return cors({ product: prod });
    }

    if (!q) return cors({ error: 'Missing q or id' }, 400);

    // Search endpoint
    const url = `https://www.pricecharting.com/api/products?t=${encodeURIComponent(token)}&q=${encodeURIComponent(q)}`;
    const r = await fetchImpl(url);
    if (!r.ok) return cors({ error: `Upstream ${r.status}` }, r.status);
    const data = await r.json();
    let products = Array.isArray(data.products) ? data.products.slice(0, limit) : [];

    // Optional: enrich first N with image via product detail
    if (withImage) {
      const top = products.slice(0, Math.min(products.length, 50));
      const enriched = await Promise.all(top.map(async (p) => {
        try {
          const pr = await fetchImpl(`https://www.pricecharting.com/api/product?t=${encodeURIComponent(token)}&id=${encodeURIComponent(p.id)}`);
          if (pr.ok) {
            const pj = await pr.json();
            p.image = pj.image_url || pj.image || p.image;
          }
        } catch {}
        return p;
      }));
      products = enriched.concat(products.slice(top.length));
    }

    return cors({ products });
  } catch (err) {
    return cors({ error: err.message }, 500);
  }
};
