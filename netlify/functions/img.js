// netlify/functions/img.js
// Image proxy to avoid hotlink/CORS issues. Allows *.sportscardspro.com and *.pricecharting.com.
const ALLOW_BASE = ['sportscardspro.com','pricecharting.com','images.pricecharting.com','img.pricecharting.com'];

exports.handler = async function(event, context) {
  const raw = (event.queryStringParameters || {}).url || '';
  if (!raw) return { statusCode: 400, body: 'Missing url' };
  let u;
  try { u = new URL(raw); } catch { return { statusCode: 400, body: 'Bad url' }; }

  const ok = ALLOW_BASE.some(base => u.hostname === base || u.hostname.endsWith('.'+base));
  if (!ok) return { statusCode: 403, body: 'Host not allowed' };

  try {
    const r = await fetch(u.toString());
    const buf = await r.arrayBuffer();
    const ct = r.headers.get('content-type') || 'image/jpeg';
    return {
      statusCode: 200,
      headers: { 'content-type': ct, 'cache-control': 'public, max-age=86400', 'access-control-allow-origin': '*' },
      body: Buffer.from(buf).toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return { statusCode: 502, body: String(e) };
  }
};
