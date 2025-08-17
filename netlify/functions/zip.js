
// netlify/functions/zip.js
// Builds a ZIP containing a CSV plus (optionally) images fetched via the image proxy.
const JSZip = require('jszip');

exports.handler = async (event) => {
  try {
    const isPost = (event.httpMethod || '').toUpperCase() === 'POST';
    const payload = isPost ? JSON.parse(event.body || '{}') : {};
    const csv = payload.csv || 'id,qty,grade\n';
    const filename = payload.filename || 'inventory.csv';
    const imageUrls = Array.isArray(payload.imageUrls) ? payload.imageUrls : [];

    const zip = new JSZip();
    zip.file(filename, csv, { binary: false });

    // Optionally fetch & add images (already proxied client-side)
    for (let i = 0; i < imageUrls.length; i++) {
      const u = imageUrls[i];
      try {
        const r = await fetch(u);
        if (!r.ok) continue;
        const ab = await r.arrayBuffer();
        const buf = Buffer.from(ab);
        const ct = r.headers.get('content-type') || '';
        const ext = ct.includes('png') ? 'png' : (ct.includes('webp') ? 'webp' : 'jpg');
        const name = `images/${String(i+1).padStart(3,'0')}.${ext}`;
        zip.file(name, buf, { binary: true });
      } catch {}
    }

    const content = await zip.generateAsync({ type: 'nodebuffer' });
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="export.zip"',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      },
      body: content.toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
