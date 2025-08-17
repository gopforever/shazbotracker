// netlify/functions/scp.js
// Slug-aware image enrichment for SportsCardsPro & PriceCharting.
// Adds ?withImage=1 support for /api/product and /api/products. Falls back to /item/<id>.
exports.handler = async function(event, context) {
  const token = process.env.SCP_TOKEN;
  if (!token) return json(500, { status: 'error', 'error-message': 'Missing SCP_TOKEN env var' });

  const p = event.queryStringParameters || {};
  const path = p.path || '/api/product';
  const id = p.id;
  const q = p.q;
  const source = p.source || 'scp'; // 'scp' or 'pc'
  const withImage = p.withImage === '1';
  const imageLimit = Math.max(0, Math.min(20, parseInt(p.imageLimit || '8')));

  const base = source === 'pc' ? 'https://www.pricecharting.com' : 'https://www.sportscardspro.com';
  const url = new URL(base + path);
  url.searchParams.set('t', token);
  if (id) url.searchParams.set('id', id);
  if (q) url.searchParams.set('q', q);

  try {
    const r = await fetch(url.toString(), { headers: { 'accept': 'application/json' } });
    const txt = await r.text();
    let data;
    try { data = JSON.parse(txt); } catch (_) { return json(r.status || 502, { status: 'error', 'error-message': txt }); }

    if (data.status !== 'success' || !withImage) return json(200, data);

    if (path === '/api/product') {
      const pageUrl = pageUrlFromData(base, data);
      const img = await fetchImageFromPage(pageUrl, base) || await fetchImageFromPage(`${base}/item/${encodeURIComponent(data.id)}`, base);
      if (img) data['image-url'] = img;
      return json(200, data);
    }

    if (path === '/api/products' && Array.isArray(data.products)) {
      const items = data.products.slice(0, imageLimit);
      await enrichListWithImages(items, base);
      return json(200, data);
    }

    return json(200, data);
  } catch (err) {
    return json(502, { status: 'error', 'error-message': String(err) });
  }
};

function slugify(s){
  if(!s) return '';
  // Remove bracketed qualifiers like [Rookie]
  s = s.replace(/\[[^\]]*\]/g, '');
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/--+/g, '-');
}

function pageUrlFromData(base, d){
  const consoleName = d['console-name'] || d.console || d.category || '';
  const productName = d['product-name'] || d.name || '';
  const c = slugify(consoleName);
  const p = slugify(productName);
  if (c && p) return `${base}/game/${c}/${p}`;
  return `${base}/item/${encodeURIComponent(d.id)}`;
}

async function enrichListWithImages(list, base){
  const limit = 4;
  let i = 0;
  async function worker(){
    while(i < list.length){
      const idx = i++;
      const p = list[idx];
      try {
        const pageUrl = pageUrlFromData(base, p);
        let img = await fetchImageFromPage(pageUrl, base);
        if (!img) img = await fetchImageFromPage(`${base}/item/${encodeURIComponent(p.id)}`, base);
        if (img) p['image-url'] = img;
      } catch(_) {}
    }
  }
  await Promise.all(Array.from({length: Math.min(limit, list.length)}, worker));
}

async function fetchImageFromPage(url, base){
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 2500);
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 CardTracker/1.0', 'accept': 'text/html' }, signal: controller.signal });
    if (!r.ok) return null;
    const html = await r.text();
    const reList = [
      /<meta[^>]+property=['"]og:image:secure_url['"][^>]+content=['"]([^'"]+)['"]/i,
      /<meta[^>]+property=['"]og:image['"][^>]+content=['"]([^'"]+)['"]/i,
      /<meta[^>]+name=['"]twitter:image['"][^>]+content=['"]([^'"]+)['"]/i,
      /<link[^>]+rel=['"]image_src['"][^>]+href=['"]([^'"]+)['"]/i,
    ];
    for(const re of reList){
      const m = re.exec(html);
      if(m && m[1]) return absolutize(m[1], base);
    }
    return null;
  } catch (_) { return null; }
  finally { clearTimeout(t); }
}

function absolutize(url, base){
  try{ const u = new URL(url, base); return u.toString(); }catch(_){ return url; }
}

function json(status, obj){
  return { statusCode: status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(obj) };
}
