// netlify/functions/scp.js
// Proxies SportsCardsPro (and PriceCharting for TCG) API requests and injects a secret token from env.
// Set SCP_TOKEN in your Netlify site environment variables.

export async function handler(event, context) {
  const token = process.env.SCP_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ status: 'error', 'error-message': 'Missing SCP_TOKEN env var' }) };
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
    const r = await fetch(url.toString(), { headers: { 'accept': 'application/json' }});
    const data = await r.json();
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ status: 'error', 'error-message': String(err) }) };
  }
}
