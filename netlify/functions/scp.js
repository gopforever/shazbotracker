// netlify/functions/scp.js
// Web API style Netlify Function
const SPORTS_GENRES = [
  "football cards","baseball cards","basketball cards","hockey cards",
  "soccer cards","wrestling cards","ufc","mma","golf cards","boxing cards"
];
const TCG_HINTS = ["pokemon","pokémon","yu-gi-oh","yugioh","magic","mtg","one piece","tcg","tcgp","digimon","lorcana","dbs"];

const norm = (s="") => s.toString().toLowerCase().replace(/[^\w\s]/g," ").replace(/\s+/g," ").trim();

const isTCG = (p) => {
  const all = norm([p.genre, p["console-name"], p["product-name"]].filter(Boolean).join(" "));
  return TCG_HINTS.some(h => all.includes(h));
};
const isSports = (p) => {
  const g = norm(p.genre || "");
  const c = norm(p["console-name"] || "");
  const n = norm(p["product-name"] || "");
  if (SPORTS_GENRES.some(x => g.includes(x))) return true;
  if ((c.includes("cards") || g.includes("cards")) && !isTCG(p)) return true;
  if (/(panini|topps|leaf|donruss|bowman|score|prizm|mosaic|select)\b/.test(n)) return true;
  return false;
};

const tok = (q) => norm(q).split(" ").filter(Boolean);
const scoreProduct = (p, qTokens, domain) => {
  const hay = norm([p["product-name"], p["console-name"], p.genre].filter(Boolean).join(" "));
  let s = 0;
  qTokens.forEach(t => { if (hay.includes(t)) s += 5; });
  if (domain === "sports") s += isSports(p) ? 100 : isTCG(p) ? -50 : 0;
  if (domain === "tcg")    s += isTCG(p) ? 100   : isSports(p) ? -30 : 0;
  const last = qTokens[qTokens.length-1] || "";
  if (last && hay.includes(` ${last} `)) s += 3;
  return s;
};

async function scpSearch(token, q) {
  const url = `https://www.sportscardspro.com/api/search?apikey=${encodeURIComponent(token)}&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { "accept":"application/json" } });
  if (!r.ok) throw new Error(`SCP ${r.status}`);
  const data = await r.json();
  return Array.isArray(data.products) ? data.products : data;
}

export default async (request, context) => {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    }});
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const withImage = searchParams.get("withImage") === "1";
    const domain = (searchParams.get("domain") || "sports").toLowerCase();
    const token = process.env.SCP_TOKEN;

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing SCP_TOKEN" }), { status: 500, headers: { "content-type":"application/json", "Access-Control-Allow-Origin":"*" } });
    }
    if (!q.trim()) {
      return new Response(JSON.stringify({ products: [], domain }), { status: 200, headers: { "content-type":"application/json", "Access-Control-Allow-Origin":"*" } });
    }

    let products = await scpSearch(token, q);

    const qTokens = tok(q).filter(w => w !== "jr" && w !== "sr");
    if ((!products || products.length === 0) && qTokens.length >= 2) {
      try {
        const last = qTokens[qTokens.length - 1];
        products = await scpSearch(token, last);
      } catch {}
    }

    let filtered = products || [];
    if (domain === "sports") filtered = filtered.filter(isSports);
    if (domain === "tcg")    filtered = filtered.filter(isTCG);

    const qTok = tok(q);
    filtered.sort((a,b) => scoreProduct(b, qTok, domain) - scoreProduct(a, qTok, domain));

    const out = filtered.slice(0, 150).map(p => {
      const img = p.image || p.thumb || p.thumbnail || p.photo || null;
      return withImage ? { ...p, image: img || null } : p;
    });

    return new Response(JSON.stringify({ products: out, domain }), {
      status: 200,
      headers: { "content-type":"application/json", "Access-Control-Allow-Origin":"*" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "proxy error" }), {
      status: 500,
      headers: { "content-type":"application/json", "Access-Control-Allow-Origin":"*" }
    });
  }
};
