Functions Fix Bundle (prevents 404 at /.netlify/functions/scp)
===============================================================

Why you're seeing 404
---------------------
A 404 at `/.netlify/functions/scp` means Netlify didn’t register that function route.
The most common causes are:
- Wrong function API (Express-style `req,res`) instead of the Web API handler Netlify expects.
- File name/path not exactly `netlify/functions/scp.js`.
- Missing/incorrect `netlify.toml` functions directory.

What this bundle includes
-------------------------
- netlify/functions/scp.js  → Web-API style function (no Express), CORS-ready, sports-first search.
- netlify/functions/img.js  → Image proxy using Web-API Response.
- netlify/functions/zip.js  → ZIP builder using jszip (remember to `npm i jszip` at repo root).
- netlify.toml              → points to `netlify/functions` and marks jszip as external; /api/* redirect.

How to deploy
-------------
1) Ensure repository root contains `package.json` with `"type": "module"` OR keep .js files as-is.
   If your repo is CJS, rename files to `.mjs` or add `"type": "module"` in package.json.
2) `npm i jszip` (commit lockfile). Netlify will install root deps during build.
3) Place files in the same paths as above.
4) Commit & deploy, or drag-and-drop the repo/zip in Netlify.
5) Verify:
   - https://<yoursite>/.netlify/functions/scp?q=michael%20penix%20jr&withImage=1
   - https://<yoursite>/.netlify/functions/img?src=https%3A%2F%2Fexample.com%2Fimage.jpg

Notes
-----
- If you prefer calling `/api/scp` from the UI, keep the redirect in netlify.toml.
- If you see 500 instead, check that `SCP_TOKEN` is set in Netlify env vars.
