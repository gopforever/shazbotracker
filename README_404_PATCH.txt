Patch: Fix 404s from function calls
===================================

What it does
------------
1) Adds Netlify redirects so any client requests to `/api/*` are routed to
   `/.netlify/functions/:splat`. This fixes 404s when the UI calls `/api/scp`
   instead of `/.netlify/functions/scp`.
2) Adds a simple `/.netlify/functions/ping` health-check to confirm functions are live.
3) Ensures `jszip` is marked as an external dependency for bundling.

How to use
----------
- Drop `netlify.toml` at your site root (merge with your existing if present).
- Add `netlify/functions/ping.js` alongside your other functions.
- Deploy and then visit:
    https://<yoursite>/.netlify/functions/ping
  If you see `{ ok: true }`, functions are working. Then try:
    https://<yoursite>/.netlify/functions/scp?q=michael%20penix%20jr&withImage=1
  or simply search in the UI.

Notes
-----
- If your UI is calling `/api/scp`, this redirect makes it work without changing the UI.
- If you still get 404 on `/.netlify/functions/scp`, verify the file name is `scp.js`
  in `netlify/functions/`, and that your build lists/bundles it.
