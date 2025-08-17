// netlify/functions/scp.js
// Netlify Web API Function with broad-search fallback.
// ESM-friendly. If your repo is CJS, either add `"type": "module"` in package.json or rename to .mjs.

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
  if (/(panini|topps|leaf|donruss|bowman|score|prizm|mosaic|select)\b/.test(c + " " + n + " " + g)) return true;
  return !isTCG(p) && /\b(cards|rookie|rc|auto|signature)\b/.test(c + " " + g);
};

const tok = (q) => norm(q).split(" ").filter(Boolean);
const uniqBy = (arr, keyFn) => {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out;
};
const scoreProduct = (p, qTokens, domain) => {
  const hay = norm([p["product-name"], p["console-name"], p.genre].filter(Boolean).join(" "));
  let s = 0;
  qTokens.forEach(t => { if (hay.includes(t)) s += 5; });
  if (domain === "sports") s += isSports(p) ? 100 : isTCG(p) ? -50 : 0;
  if (domain === "tcg")    s += isTCG(p) ? 100   : isSports(p) ? -30 : 0;
  // prefer Panini/Score for sports queries
  if (/\b(panini|score|donruss|topps|bowman)\b/.test(hay)) s += 3;
  // prefer 2025 for this set
  if (hay.includes(" 2025 ")) s += 2;
  // small boost if "rookie" present for rookie searches
  if (qTokens.includes("rookie") && hay.includes("rookie")) s += 2;
  return s;
};

async function scpSearch(token, q) {
  const url = `https://www.sportscardspro.com/api/search?apikey=${encodeURIComponent(token)}&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { "accept":"application/json" } });
  if (!r.ok) throw new Error(`SCP ${r.status}`);
  const data = await r.json();
  return Array.isArray(data?.products) ? data.products : (Array.isArray(data) ? data : []);
}

function buildBroadQueries(q) {
  const Q = [];
  const base = norm(q);
  Q.push(q);
  // If it's the common Panini Score set, add some tailored alternates
  if (/\b2025\b/.test(base) && base.includes("score")) {
    Q.push("2025 panini score");
    Q.push("2025 score");
    Q.push("panini score rookie");
    Q.push("panini score football");
  }
  // Decompose into token pairs
  const t = tok(q);
  for (let i = 0; i < t.length; i++) {
    for (let j = i+1; j < t.length; j++) {
      const pair = t[i] + " " + t[j];
      if (pair.length >= 6) Q.push(pair);
    }
  }
  // Add individual strong tokens (not just year)
  for (const word of t) {
    if (!/^(20\d{2}|rc|cards|rookie|football|panini|score)$/.test(word) && word.length > 2) {
      Q.push(word);
    }
  }
  // Deduplicate while keeping order
  return [...new Set(Q.filter(Boolean))];
}

export default async (request) => {
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "150", 10), 300);
    const token = process.env.SCP_TOKEN;

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing SCP_TOKEN" }), { status: 500, headers: { "content-type":"application/json", "Access-Control-Allow-Origin":"*" } });
    }
    if (!q.trim()) {
      return new Response(JSON.stringify({ products: [], domain }), { status: 200, headers: { "content-type":"application/json", "Access-Control-Allow-Origin":"*" } });
    }

    // Primary search
    let products = [];
    try {
      products = await scpSearch(token, q);
    } catch (e) {
      // Allow to continue to broad queries
      products = [];
    }

    // Auto-broaden when primary yields few results
    if (!products || products.length < 10) {
      const queries = buildBroadQueries(q);
      const results = await Promise.allSettled(queries.map(q2 => scpSearch(token, q2)));
      for (const r of results) {
        if (r.status === "fulfilled" && Array.isArray(r.value)) {
          products = products.concat(r.value);
        }
      }
    }

    // Dedupe by ID or name+console pair
    const deduped = uniqBy(products, p => (p.id || "") + "::" + (p["product-name"] || "") + "::" + (p["console-name"] || ""));

    // Domain filtering
    let filtered = deduped;
    if (domain === "sports") filtered = filtered.filter(isSports);
    if (domain === "tcg")    filtered = filtered.filter(isTCG);

    // Scoring & limiting
    const qTok = tok(q);
    filtered.sort((a,b) => scoreProduct(b, qTok, domain) - scoreProduct(a, qTok, domain));
    const out = filtered.slice(0, limit).map(p => {
      const img = p.image || p.thumb || p.thumbnail || p.photo || null;
      return withImage ? { ...p, image: img || null } : p;
    });

    return new Response(JSON.stringify({ products: out, domain, count: out.length }), {
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
