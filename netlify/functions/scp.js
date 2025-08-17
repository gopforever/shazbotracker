// netlify/functions/scp.js
// Uses Netlify Functions' native fetch (Node 18+). No external deps required.
// Set SCP_TOKEN in Site settings → Environment variables.
exports.handler = async function(event, context) {
  const token = process.env.SCP_TOKEN;
  if (!token) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify({ status: 'error', 'error-message': 'Missing SCP_TOKEN env var' })
    };
  }

  const params = event.queryStringParameters || {};
  const path = params.path || '/api/product';
  const id = params.id;
  const q = params.q;
  const source = params.source || 'scp'; // 'scp' or 'pc'

  const base = source === 'pc' ? 'https://www.pricecharting.com' : 'https://www.sportscardspro.com';
  const url = new URL(base + path);
  url.searchParams.set('t', token);
  if (id) url.searchParams.set('id', id);
  if (q) url.searchParams.set('q', q);

  try {
    const r = await fetch(url.toString(), { headers: { 'accept': 'application/json' } });
    const text = await r.text();
    // Some backends return invalid JSON on errors; pass it through.
    try {
      const data = JSON.parse(text);
      return { statusCode: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(data) };
    } catch (_) {
      return { statusCode: r.status || 502, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ status: 'error', 'error-message': text }) };
    }
  } catch (err) {
    return { statusCode: 502, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ status: 'error', 'error-message': String(err) }) };
  }
};
