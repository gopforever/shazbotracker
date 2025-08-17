// netlify/functions/ping.js
export const config = { path: "/.netlify/functions/ping" };

export default async (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString(), tip: "If this works but scp 404s, the function file/name is wrong or not deployed." });
};
