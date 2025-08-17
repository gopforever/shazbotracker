// netlify/functions/scp.js
export const config = { path: "/.netlify/functions/scp" };

const SPORTS_GENRES = [
  "Football Cards","Baseball Cards","Basketball Cards","Hockey Cards",
  "Soccer Cards","Wrestling Cards","UFC","MMA","Golf Cards","Boxing Cards"
];

const TCG_HINTS = ["pokemon","pokémon","yu-gi-oh","yugioh","magic","mtg","one piece","tcg","tcgp","digimon","lorcana","dbs"];

const norm = (s="") => s.toString().toLowerCase().replace(/[^\w\s]/g," ").replace(/\s+/g," ").trim();

const isSports = (p) => {
  const g = norm(p.genre || "");
  const c = norm(p["console-name"] || "");
  const n = norm(p["product-name"] || "");
  if (SPORTS_GENRES.some(x => g.includes(norm(x)))) return true;
  // Common sports hints
  if (c.includes("cards") || g.includes("cards")) {
    if (!TCG_HINTS.some(h => c.includes(h) || g.includes(h) || n.includes(h))) return true;
  }
  // Brand hints
  if (/(panini|topps|leaf|donruss|bowman|score|prizm|mosaic|select)\b/.test(n)) return true;
  return false;
};

const isTCG = (p) => {
  const all = norm([p.genre, p["console-name"], p["product-name"]].filter(Boolean).join(" "));
  return TCG_HINTS.some(h => all.includes(h));
};

const scoreProduct = (p, qTokens, domain) => {
  const hay = norm([p["product-name"], p["console-name"], p.genre].filter(Boolean).join(" "));
  let s = 0;
  qTokens.forEach(t => { if (hay.includes(t)) s += 5; });
  // domain bias
  if (domain === "sports") s += isSports(p) ? 100 : isTCG(p) ? -50 : 0;
  if (domain === "tcg")    s += isTCG(p) ? 100   : isSports(p) ? -30 : 0;
  // slight boost for exact player last name
  const last = qTokens[qTokens.length-1] || "";
  if (last && hay.includes(` ${last} `)) s += 3;
  return s;
};

export default async (req, res) => {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const withImage = url.searchParams.get("withImage") === "1";
    const domain = (url.searchParams.get("domain") || "sports").toLowerCase(); // default to sports
    const token = process.env.SCP_TOKEN;

    if (!token) return res.status(500).json({ error: "Missing SCP_TOKEN" });
    if (!q.trim()) return res.json({ products: [] });

    // ——— Call SportsCardsPro ———
    const apiURL = `https://www.sportscardspro.com/api/search?apikey=${encodeURIComponent(token)}&q=${encodeURIComponent(q)}`;
    const resp = await fetch(apiURL, { headers: { "accept":"application/json" } });
    if (!resp.ok) return res.status(resp.status).json({ error: `SCP ${resp.status}` });

    const data = await resp.json();
    const products = Array.isArray(data.products) ? data.products : data;

    // Normalize tokens (“jr.” → “jr”)
    const qTokens = norm(q).split(" ").filter(Boolean);

    // Filter by domain (server-side)
    let filtered = products;
    if (domain === "sports") filtered = products.filter(p => isSports(p));
    if (domain === "tcg")    filtered = products.filter(p => isTCG(p));

    // Rank results
    filtered.sort((a,b) => scoreProduct(b,qTokens,domain) - scoreProduct(a,qTokens,domain));

    // Optional image enrichment (preserves your existing image proxy flow)
    const out = filtered.slice(0, 100).map(p => {
      const img = p.image || p.thumb || p.thumbnail || p.photo || null;
      return withImage ? { ...p, image: img || null } : p;
    });

    res.json({ products: out, domain });
  } catch (e) {
    res.status(500).json({ error: e.message || "proxy error" });
  }
};
