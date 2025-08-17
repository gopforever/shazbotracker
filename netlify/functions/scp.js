/* SportsCardsPro/PriceCharting search proxy (serverless) */
const PRICECHARTING_BASE = "https://www.pricecharting.com";
const TOKEN = process.env.SCP_TOKEN;

const isSportsGenre = (genre) => {
  if (!genre) return false;
  // Allow sports like "Football Cards", "Basketball Cards", etc.
  // Exclude TCG like "Pokemon Card" (singular) and other non-sports.
  return /\bCards\b/i.test(genre) && !/\bPokemon Card\b/i.test(genre);
};

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) {
    throw new Error(`Upstream returned non-JSON (${res.status}): ${text.slice(0,200)}`);
  }
  if (!res.ok || data.status === "error") {
    const msg = data["error-message"] || res.statusText || "Unknown error";
    throw new Error(`Upstream error (${res.status}): ${msg}`);
  }
  return data;
}

// Attempt to get a product image by scraping og:image from SportsCardsPro product page
async function tryGetThumb(productId) {
  try {
    const page = await fetch(`https://www.sportscardspro.com/product/${productId}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ShazbotBot/1.0)" },
    });
    const html = await page.text();
    const m = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (m) return m[1];
  } catch {}
  return null;
}

exports.handler = async (event) => {
  try {
    if (!TOKEN) {
      return { statusCode: 500, body: JSON.stringify({ status:"error", message:"Missing SCP_TOKEN env var" }) };
    }
    const { q, onlySports = "1", withImage = "1" } = event.queryStringParameters || {};
    if (!q) {
      return { statusCode: 400, body: JSON.stringify({ status:"error", message:"Missing q" }) };
    }

    // Step 1: search products (first 20)
    const searchUrl = `${PRICECHARTING_BASE}/api/products?t=${encodeURIComponent(TOKEN)}&q=${encodeURIComponent(q)}`;
    const search = await fetchJson(searchUrl);

    let products = search.products || [];

    // Step 2: Hydrate details for each product (to get genre/prices) & filter sports if requested
    const needDetails = String(onlySports) === "1" || String(withImage) === "1";
    if (needDetails && products.length) {
      const detailPromises = products.map(async (p) => {
        const detailUrl = `${PRICECHARTING_BASE}/api/product?t=${encodeURIComponent(TOKEN)}&id=${encodeURIComponent(p.id)}`;
        try {
          const d = await fetchJson(detailUrl);
          // attach id, product-name, console-name from search if absent
          d.id = d.id || p.id;
          d["product-name"] = d["product-name"] || p["product-name"];
          d["console-name"] = d["console-name"] || p["console-name"];
          return d;
        } catch (e) {
          // if detail fails, keep the minimal item
          return { ...p };
        }
      });
      let detailed = await Promise.all(detailPromises);

      if (String(onlySports) === "1") {
        detailed = detailed.filter((d) => isSportsGenre(d.genre));
      }
      // Step 3: Thumbnails
      if (String(withImage) === "1") {
        const thumbs = await Promise.all(detailed.map((d) => tryGetThumb(d.id)));
        detailed = detailed.map((d, i) => ({ ...d, thumb: thumbs[i] || null }));
      }
      products = detailed;
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
      body: JSON.stringify({ status:"success", products }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ status:"error", message:String(err && err.message || err) }),
    };
  }
};
