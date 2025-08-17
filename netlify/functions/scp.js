// netlify/functions/scp.js
// Sports-first search proxy for SportsCardsPro
export const config = { path: "/.netlify/functions/scp" };

const SPORTS_GENRES = [
  "football cards","baseball cards","basketball cards","hockey cards",
  "soccer cards","wrestling cards","ufc","mma","golf cards","boxing cards"
];

const TCG_HINTS = ["pokemon","pokémon","yu-gi-oh","yugioh","magic","mtg","one piece","tcg","tcgp","digimon","lorcana","dbs"];

const norm = (s="") => s.toString().toLowerCase().replace(/[^\w\s]/g," ").replace(/\s+/g," ").trim();

const isSports = (p) => {
  const g = norm(p.genre || "");
  const c = norm(p["console-name"] || "");
  const n = norm(p["product-name"] || "");
  if (SPORTS_GENRES.some(x => g.includes(x))) return true;
  if ((c.includes("cards") || g.includes("cards")) && !isTCG(p)) return true;
  if (/(panini|topps|leaf|donruss|bowman|score|prizm|mosaic|select)\b/.test(n)) return true;
  return false;
};

const isTCG = (p) => {
  const all = norm([p.genre, p["console-name"], p["product-name"]].filter(Boolean).join(" "));
  return TCG_HINTS.some(h => all.includes(h));
};

const tok = (q) => norm(q).split(" ").filter(Boolean);

const scoreProduct = (p, qTokens, domain) => {
  const hay = norm([p["product-name"], p["console-name"], p.genre].filter(Boolean).join(" "));
  let s = 0;
  qTokens.forEach(t => { if (hay.includes(t)) s += 5; });
  if (domain === "sports") s += isSports(p) ? 100 : isTCG(p) ? -50 : 0;
  if (domain === "tcg")    s += isTCG(p) ? 100   : isSports(p) ? -30 : 0;
  // boost for exact last-name hit
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

export default async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const q = url.searchParams.get("q") || "";
    const withImage = url.searchParams.get("withImage") === "1";
    const domain = (url.searchParams.get("domain") || "sports").toLowerCase(); // default to sports
    const token = process.env.SCP_TOKEN;

    if (!token) return res.status(500).json({ error: "Missing SCP_TOKEN" });
    if (!q.trim()) return res.json({ products: [], domain });

    // primary search
    let products = await scpSearch(token, q);

    // if nothing useful and query has more than one token, try last-name fallback (e.g., "michael penix jr" -> "penix")
    const qTokens = tok(q).filter(w => w !== "jr" && w !== "sr");
    if ((!products || products.length === 0) && qTokens.length >= 2) {
      const last = qTokens[qTokens.length - 1];
      try {
        products = await scpSearch(token, last);
      } catch {}
    }

    // filter by domain
    let filtered = products || [];
    if (domain === "sports") filtered = filtered.filter(isSports);
    if (domain === "tcg")    filtered = filtered.filter(isTCG);

    // re-rank
    const qTok = tok(q).filter(Boolean);
    filtered.sort((a,b) => scoreProduct(b, qTok, domain) - scoreProduct(a, qTok, domain));

    // image enrichment
    const out = filtered.slice(0, 150).map(p => {
      const img = p.image || p.thumb || p.thumbnail || p.photo || null;
      return withImage ? { ...p, image: img || null } : p;
    });

    res.json({ products: out, domain });
  } catch (e) {
    res.status(500).json({ error: e.message || "proxy error" });
  }
};
