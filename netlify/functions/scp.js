// netlify/functions/scp.js
// Native fetch (Node 18+). Adds optional ?withImage=1 to scrape og:image from item page.
exports.handler = async function(event, context) {
  const token = process.env.SCP_TOKEN;
  if (!token) {
    return resJSON(500, { status: 'error', 'error-message': 'Missing SCP_TOKEN env var' });
  }

  const p = event.queryStringParameters || {};
  const path = p.path || '/api/product';
  const id = p.id;
  const q = p.q;
  const source = p.source || 'scp'; // 'scp' or 'pc'
  const withImage = p.withImage === '1';

  const base = source === 'pc' ? 'https://www.pricecharting.com' : 'https://www.sportscardspro.com';
  const url = new URL(base + path);
  url.searchParams.set('t', token);
  if (id) url.searchParams.set('id', id);
  if (q) url.searchParams.set('q', q);

  try {
    const r = await fetch(url.toString(), { headers: { 'accept': 'application/json' } });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch (_) {
      return resJSON(r.status || 502, { status: 'error', 'error-message': text });
    }
    if (data.status !== 'success') {
      return resJSON(200, data);
    }

    // Optionally augment with image-url
    if (withImage && id) {
      try {
        const itemUrl = source === 'pc' ? new URL(`/item/${id}`, base) : new URL(`/item/${id}`, base);
        const htmlRes = await fetch(itemUrl.toString(), { headers: { 'user-agent': 'Mozilla/5.0 CardTracker/1.0', 'accept': 'text/html' } });
        const html = await htmlRes.text();
        const og = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html);
        if (og && og[1]) data['image-url'] = og[1];
      } catch (e) {
        // ignore scrape failures
      }
    }

    return resJSON(200, data);
  } catch (err) {
    return resJSON(502, { status: 'error', 'error-message': String(err) });
  }
};

function resJSON(status, obj){
  return { statusCode: status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(obj) };
}
