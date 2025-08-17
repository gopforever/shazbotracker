# Shazbot — Sports Cards & TCG Inventory

Ready-to-deploy folder for Netlify.

## What’s included
- `index.html` + `/assets/app.js` (clean UI, search, per-item grade override, thumbnails, CSV import/export, ZIP export)
- Netlify Functions in `netlify/functions`:
  - `scp.js` — server-side proxy to PriceCharting/SportsCardsPro. Uses env var `SCP_TOKEN`. Supports `?q=` search and `?id=` detail, with `&withImage=1` enrichment.
  - `img.js` — image proxy for thumbnails.
  - `zip.js` — builds `export.zip` containing `inventory.csv` + optional images.
- `package.json` declaring `jszip` dependency (Netlify installs top-level deps)
- `netlify.toml` to set bundler + external modules
- `/images/logo.svg`, `/images/logo.png` (placeholder), and `/images/placeholder-card.svg`

## Deploy
1. In Netlify site settings → **Environment variables**: set `SCP_TOKEN` to your pricing API key.
2. Deploy this folder (drag-drop in Netlify UI or `netlify deploy --prod`).
3. Open your site and search (e.g., “2025 Score Rookies”). Thumbnails are proxied via `/.netlify/functions/img`.

## Notes
- Node 18+ runtime is assumed (global `fetch` in functions).
- If you use a framework later, keep static images under `/images/` or the framework’s `public/` dir so `/images/logo.png` won’t 404.
