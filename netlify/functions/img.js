// netlify/functions/img.js
// Simple image proxy to avoid hotlink restrictions & enable CORS.
// Limits to whitelisted hosts for safety.
const ALLOW = new Set([
  'www.sportscardspro.com',
  'sportscardspro.com',
  'www.pricecharting.com',
  'pricecharting.com',
  'images.pricecharting.com',
  'img.pricecharting.com',
  'images-*.pricecharting.com'.replace('*',''), // rough safety
  'i.imgur.com',
  'images.sportscardspro.com',
  'img.sportscardspro.com'
]);

exports.handler = async function(event, context) {
  const raw = (event.queryStringParameters || {}).url || '';
  if (!raw) return { statusCode: 400, body: 'Missing url' };
  let u;
  try { u = new URL(raw); } catch { return { statusCode: 400, body: 'Bad url' }; }
  if (![...ALLOW].some(h => u.hostname === h || u.hostname.endsWith('.' + h))) {
    return { statusCode: 403, body: 'Host not allowed' };
  }
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
