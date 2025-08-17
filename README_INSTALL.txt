Netlify Functions Patch (search + thumbnails)
============================================

This drop-in adds a reliable search function and a thumbnail image proxy.

Files
-----
- netlify/functions/scp.js  — calls PriceCharting API, filters sports only, returns thumb URLs
- netlify/functions/img.js  — fetches SportscardsPro product page and proxies its og:image
- package-additions.json    — dependencies to merge into your root package.json
- netlify.toml.example      — reference config if you need one

Install
-------
1) Copy `netlify/functions/` from this zip into your repo (same paths).
2) Ensure your root `package.json` includes the dependencies from `package-additions.json`.
   - Run: npm i cheerio jszip
   - Commit `package-lock.json` too.
3) In Netlify:
   - Set environment variable **SCP_TOKEN** to your API token.
   - Functions dir should be `netlify/functions`.
4) Deploy.
5) Test:
   - /.netlify/functions/scp?q=2025%20score%20rookie&withImage=1
   - /.netlify/functions/scp?q=michael%20penix%20jr&withImage=1
   - The table thumbnails should render via `/.netlify/functions/img?id=<productId>`

Notes
-----
- The search function filters results whose `console-name` starts with a known sports set (Football Cards, Basketball Cards, etc.) to avoid TCG bleed.
- If you want all domains (sports + TCG), remove the filter block in scp.js.
