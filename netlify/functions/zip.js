// netlify/functions/zip.js
// Static require of jszip so Netlify bundles dependency deterministically.
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

    // Optionally bundle images under /images
    for (let i = 0; i < imageUrls.length; i++) {
      const u = imageUrls[i];
      try {
        const r = await fetch(u);
        if (!r.ok) continue;
        const ab = await r.arrayBuffer();
        const buf = Buffer.from(ab);
        const ext = (r.headers.get('content-type') || 'image/jpeg').includes('png') ? 'png' : 'jpg';
        zip.file(`images/${String(i+1).padStart(3,'0')}.${ext}`, buf, { binary: true });
      } catch (_) {
        // ignore single image failure
      }
    }

    const content = await zip.generateAsync({ type: 'nodebuffer' });
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="export.zip"',
        'Cache-Control': 'no-store'
      },
      body: content.toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
