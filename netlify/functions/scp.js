// netlify/functions/scp.js
// Adds optional ?withImage=1 support for both /api/product and /api/products (scrapes og:image).
// Uses Netlify's native fetch. Set SCP_TOKEN in Site settings → Environment variables.
exports.handler = async function(event, context) {
  const token = process.env.SCP_TOKEN;
  if (!token) return json(500, { status: 'error', 'error-message': 'Missing SCP_TOKEN env var' });

  const p = event.queryStringParameters || {};
  const path = p.path || '/api/product';
  const id = p.id;
  const q = p.q;
  const source = p.source || 'scp';
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

    if (path === '/api/product' && id) {
      const imageUrl = await fetchOgImage(`${base}/item/${encodeURIComponent(id)}`);
      if (imageUrl) data['image-url'] = imageUrl;
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

async function enrichListWithImages(list, base){
  const limit = 4;
  let i = 0;
  async function worker(){
    while(i < list.length){
      const idx = i++;
      const p = list[idx];
      try {
        const img = await fetchOgImage(`${base}/item/${encodeURIComponent(p.id)}`);
        if (img) p['image-url'] = img;
      } catch(_) {}
    }
  }
  const workers = Array.from({length: Math.min(limit, list.length)}, worker);
  await Promise.all(workers);
}

async function fetchOgImage(url){
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 1500);
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 CardTracker/1.0', 'accept': 'text/html' }, signal: controller.signal });
    const html = await r.text();
    const m = /<meta[^>]+property=['"]og:image['"][^>]+content=['"]([^'"]+)['"]/i.exec(html);
    return m && m[1] ? m[1] : null;
  } catch (_) { return null; }
  finally { clearTimeout(t); }
}

function json(status, obj){
  return { statusCode: status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(obj) };
}
