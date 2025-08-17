
// netlify/functions/img.js
// Simple image proxy to hide referers and enable CORS-safe thumbnails.
const fetchImpl = global.fetch;

exports.handler = async (event) => {
  try {
    const u = new URL(event.rawUrl || `http://x.local${event.path}${event.rawQuery ? '?'+event.rawQuery : ''}`);
    const src = u.searchParams.get('src');
    if (!src) {
      return { statusCode: 400, body: 'Missing src' };
    }
    const r = await fetchImpl(src, {
      headers: {
        // Avoid hotlink blocking where possible
        'User-Agent': 'Mozilla/5.0 (compatible; Shazbot/1.0)'
      }
    });
    const ct = r.headers.get('content-type') || 'application/octet-stream';
    const ab = await r.arrayBuffer();
    const buf = Buffer.from(ab);
    return {
      statusCode: r.ok ? 200 : r.status,
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      },
      body: buf.toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    return { statusCode: 500, body: String(err) };
  }
};
