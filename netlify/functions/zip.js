// netlify/functions/zip.js
const JSZip = require("jszip");
exports.handler = async (event) => {
  try {
    const ids = ((event.queryStringParameters || {}).ids || "").split(",").map(s => s.trim()).filter(Boolean);
    const name = (event.queryStringParameters || {}).name || "cards";
    const zip = new JSZip();
    zip.file("readme.txt", `Export created at ${new Date().toISOString()}\n`);
    zip.file("inventory.json", JSON.stringify({ ids }, null, 2));
    const content = await zip.generateAsync({ type: "nodebuffer" });
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${name}.zip"`,
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      },
      body: content.toString("base64"),
      isBase64Encoded: true
    };
  } catch (e) { return { statusCode: 500, body: String(e) }; }
};
